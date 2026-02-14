import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BrainExplorerHeader from '../components/note/BrainExplorerHeader';
import GraphCanvas from '../components/note/GraphCanvas';
import NodePreviewDrawer from '../components/note/NodePreviewDrawer';
import { useBrainGraph, useGlobalGraph } from '../api/brainQueries';

export default function BrainGraphView() {
  const { brainId } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterEdgeType, setFilterEdgeType] = useState('');
  const [minWeight, setMinWeight] = useState('');
  const [localMode, setLocalMode] = useState(false);
  const [localNodeId, setLocalNodeId] = useState('');
  const [localHops, setLocalHops] = useState(1);
  const [graphMode, setGraphMode] = useState('current'); // 'current' | 'global'
  const [selectedNode, setSelectedNode] = useState(null);

  const { data: currentGraph, isLoading: currentLoading } = useBrainGraph(brainId);
  const { data: globalGraph, isLoading: globalLoading } = useGlobalGraph();

  const isGlobal = graphMode === 'global';
  const graphData = isGlobal ? globalGraph : currentGraph;
  const loading = isGlobal ? globalLoading : currentLoading;

  const allTags = [];
  (graphData?.nodes ?? []).forEach((n) => (n.tags || []).forEach((t) => t && !allTags.includes(t) && allTags.push(t)));
  const edgeTypes = [...new Set((graphData?.edges ?? []).map((e) => e.type).filter(Boolean))];

  const graphDataOverride = graphData ? { nodes: graphData.nodes || [], edges: graphData.edges || [] } : null;

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (brainId) navigate(`/brain/${brainId}/notes`);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [brainId, navigate]);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex flex-col">
      <BrainExplorerHeader
        title={isGlobal ? 'Global Graph' : 'Graph'}
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[rgb(var(--muted))]">Graph:</span>
            <button
              type="button"
              onClick={() => setGraphMode('current')}
              className={`px-2 py-1 rounded text-sm ${graphMode === 'current' ? 'bg-[rgb(var(--accent))] text-white' : 'bg-[rgb(var(--panel2))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]'}`}
            >
              Current Brain
            </button>
            <button
              type="button"
              onClick={() => setGraphMode('global')}
              className={`px-2 py-1 rounded text-sm ${graphMode === 'global' ? 'bg-[rgb(var(--accent))] text-white' : 'bg-[rgb(var(--panel2))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]'}`}
            >
              All Brains
            </button>
            <button
              type="button"
              onClick={() => navigate(`/brain/${brainId}/notes`)}
              className="text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]"
            >
              Notes
            </button>
          </div>
        }
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-2 p-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex-wrap">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search / focus node…"
            className="flex-1 min-w-[120px] max-w-xs px-3 py-1.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="px-2 py-1.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] text-[rgb(var(--text))] text-xs">
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterEdgeType} onChange={(e) => setFilterEdgeType(e.target.value)} className="px-2 py-1.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] text-[rgb(var(--text))] text-xs">
            <option value="">All edge types</option>
            {edgeTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" value={minWeight} onChange={(e) => setMinWeight(e.target.value)} placeholder="Min weight" className="w-20 px-2 py-1.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-sm text-[rgb(var(--text))]" step="0.1" />
          {!isGlobal && (
            <>
              <label className="flex items-center gap-1 text-xs text-[rgb(var(--text))]">
                <input type="checkbox" checked={localMode} onChange={(e) => setLocalMode(e.target.checked)} />
                Local graph
              </label>
              {localMode && (
                <>
                  <input type="text" value={localNodeId} onChange={(e) => setLocalNodeId(e.target.value)} placeholder="Node ID" className="w-32 px-2 py-1.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-xs" />
                  <select value={localHops} onChange={(e) => setLocalHops(Number(e.target.value))} className="px-2 py-1.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] text-xs">
                    {[1, 2, 3].map((h) => <option key={h} value={h}>{h} hop{h > 1 ? 's' : ''}</option>)}
                  </select>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex-1 min-h-0 w-full flex">
          <div className="flex-1 min-h-0 min-w-0">
            {isGlobal && globalLoading ? (
              <div className="w-full h-full flex items-center justify-center text-[rgb(var(--muted))]">
                Loading global graph…
              </div>
            ) : (
            <GraphCanvas
              filterTag={filterTag}
              filterEdgeType={filterEdgeType}
              minWeight={minWeight === '' ? null : Number(minWeight)}
              localGraphNodeId={!isGlobal && localMode && localNodeId ? localNodeId : null}
              localGraphHops={localHops}
              searchQuery={searchQuery}
              graphDataOverride={graphDataOverride}
              onNodeClick={handleNodeClick}
              isGlobalMode={isGlobal}
            />
            )}
          </div>
          {selectedNode && (
            <NodePreviewDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
