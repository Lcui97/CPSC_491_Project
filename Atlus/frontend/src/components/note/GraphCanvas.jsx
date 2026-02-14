import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { useBrainStore } from '../../store/brainStore';

const TAG_COLORS = [
  'rgb(var(--accent))',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
];

const BRAIN_COLORS = ['#e76f51', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

function tagToColor(tags) {
  if (!tags?.length) return 'rgb(var(--muted))';
  const i = tags[0].length % TAG_COLORS.length;
  return TAG_COLORS[i];
}

function brainToColor(brainId) {
  if (!brainId) return 'rgb(var(--muted))';
  let h = 0;
  for (let i = 0; i < brainId.length; i++) h = (h << 5) - h + brainId.charCodeAt(i);
  return BRAIN_COLORS[Math.abs(h) % BRAIN_COLORS.length];
}

export default function GraphCanvas({
  filterTag = '',
  filterEdgeType = '',
  minWeight = null,
  localGraphNodeId = null,
  localGraphHops = 1,
  searchQuery = '',
  graphDataOverride = null,
  onNodeClick = null,
  isGlobalMode = false,
}) {
  const { brainId } = useParams();
  const navigate = useNavigate();
  const { getGraph, fetchGraph } = useBrainStore();
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const graphRef = useCallback((ref) => {
    if (!ref) return;
    ref.d3Force('charge').strength(-200);
  }, []);

  useEffect(() => {
    if (graphDataOverride) {
      setGraphData({ nodes: graphDataOverride.nodes || [], links: graphDataOverride.edges || [] });
      setLoading(false);
      return;
    }
    if (!brainId) return;
    const raw = getGraph(brainId);
    if (raw?.nodes) {
      setGraphData({ nodes: raw.nodes, links: raw.edges || [] });
      setLoading(false);
    } else {
      setLoading(true);
      fetchGraph(brainId).then((d) => {
        setGraphData({ nodes: d.nodes || [], links: d.edges || [] });
      }).finally(() => setLoading(false));
    }
  }, [brainId, fetchGraph, getGraph, graphDataOverride]);

  const { nodes, links } = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    let ns = [...(graphData.nodes || [])];
    let ls = [...(graphData.links || [])].map((e) => ({
      ...e,
      source: typeof e.source === 'object' ? e.source.id : e.source,
      target: typeof e.target === 'object' ? e.target.id : e.target,
    }));

    if (filterTag) {
      const tagSet = new Set(ns.filter((n) => (n.tags || []).includes(filterTag)).map((n) => n.id));
      ns = ns.filter((n) => tagSet.has(n.id));
      ls = ls.filter((l) => tagSet.has(l.source) && tagSet.has(l.target));
    }
    if (filterEdgeType) {
      ls = ls.filter((l) => (l.type || '') === filterEdgeType);
    }
    if (minWeight != null && minWeight !== '') {
      const w = Number(minWeight);
      if (!Number.isNaN(w)) ls = ls.filter((l) => (l.weight ?? 0) >= w);
    }
    if (localGraphNodeId && localGraphHops >= 1) {
      const hopSet = new Set([localGraphNodeId]);
      for (let h = 0; h < localGraphHops; h++) {
        ls.forEach((l) => {
          if (hopSet.has(l.source)) hopSet.add(l.target);
          if (hopSet.has(l.target)) hopSet.add(l.source);
        });
      }
      ns = ns.filter((n) => hopSet.has(n.id));
      ls = ls.filter((l) => hopSet.has(l.source) && hopSet.has(l.target));
    }
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      ns = ns.filter((n) => (n.title || '').toLowerCase().includes(lower));
      const idSet = new Set(ns.map((n) => n.id));
      ls = ls.filter((l) => idSet.has(l.source) && idSet.has(l.target));
    }

    const nodeIds = new Set(ns.map((n) => n.id));
    ls = ls.filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));
    const deg = {};
    ls.forEach((l) => {
      deg[l.source] = (deg[l.source] || 0) + 1;
      deg[l.target] = (deg[l.target] || 0) + 1;
    });
    ns = ns.map((n) => ({ ...n, degree: deg[n.id] || 0 }));

    return { nodes: ns, links: ls };
  }, [graphData, filterTag, filterEdgeType, minWeight, localGraphNodeId, localGraphHops, searchQuery]);

  const gData = useMemo(() => ({ nodes, links }), [nodes, links]);

  const handleNodeClick = useCallback(
    (node) => {
      if (onNodeClick) onNodeClick(node);
      else navigate(`/brain/${brainId}/notes/${node.id}`);
    },
    [brainId, navigate, onNodeClick]
  );

  const nodeColor = useCallback((node) => (isGlobalMode ? brainToColor(node.brain_id) : tagToColor(node.tags)), [isGlobalMode]);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.title || node.id?.slice(0, 8) || '?';
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const size = 4 + Math.min(node.degree || 0, 8);
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor(node);
    ctx.fill();
    ctx.strokeStyle = 'rgb(var(--border))';
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();
    ctx.fillStyle = 'rgb(var(--text))';
    ctx.textAlign = 'center';
    ctx.fillText(label.slice(0, 20), node.x, node.y + size + fontSize);
  }, []);

  const linkWidth = useCallback((link) => Math.max(0.5, (link.weight ?? 1) * 1.5), []);

  if (loading || !gData.nodes.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[rgb(var(--muted))]">
        {loading ? 'Loading graph…' : 'No nodes in this brain.'}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px]">
      <ForceGraph2D
        ref={graphRef}
        graphData={gData}
        onNodeClick={handleNodeClick}
        nodeCanvasObject={nodeCanvasObject}
        nodeLabel={(n) => `${n.title || ''}\n${(n.tags || []).join(', ')}${isGlobalMode && n.brain_id ? `\nBrain: ${n.brain_id}` : ''}`}
        linkWidth={linkWidth}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
      />
    </div>
  );
}
