import { useState, useEffect } from 'react';
import { api } from '../../api/client';

// Example nodes shown when the user has no graph data (or merged with real data)
const EXAMPLE_NODES = [
  { id: 'welcome', title: 'Welcome', summary: 'Start here to explore your knowledge graph.', related_node_ids: ['getting-started'] },
  { id: 'getting-started', title: 'Getting started', summary: 'Create a Brain, add documents, and connect ideas.', related_node_ids: [] },
];

function NodeCircle({ node, x, y, isHighlighted, onClick }) {
  return (
    <g onClick={() => onClick?.(node)} className="cursor-pointer">
      <circle
        cx={x}
        cy={y}
        r={44}
        fill="rgb(var(--panel2))"
        stroke={isHighlighted ? 'rgb(var(--accent))' : 'rgb(var(--border))'}
        strokeWidth={isHighlighted ? 3 : 1.5}
        className="transition-all hover:stroke-[rgb(var(--accent))]"
      />
      <text
        x={x}
        y={y - 6}
        textAnchor="middle"
        className="text-sm font-semibold fill-[rgb(var(--text))] pointer-events-none"
      >
        {node.title.length > 14 ? node.title.slice(0, 12) + '…' : node.title}
      </text>
      <text
        x={x}
        y={y + 8}
        textAnchor="middle"
        className="text-[10px] fill-[rgb(var(--muted))] pointer-events-none"
      >
        {node.summary?.slice(0, 18)}{node.summary?.length > 18 ? '…' : ''}
      </text>
    </g>
  );
}

function Edge({ x1, y1, x2, y2 }) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="rgb(var(--border))"
        strokeWidth={2}
        markerEnd="url(#arrowhead)"
      />
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="rgb(var(--muted))" />
        </marker>
      </defs>
    </g>
  );
}

export default function GraphView() {
  const [nodes, setNodes] = useState([]);
  const [highlightId, setHighlightId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load nodes from all brains for the graph (optional); fall back to example
  useEffect(() => {
    api('/api/brain/list')
      .then((res) => {
        const brains = res.brains || [];
        if (brains.length === 0) {
          setNodes(EXAMPLE_NODES);
          return;
        }
        return Promise.all(
          brains.map((b) => api(`/api/brain/${b.id}/nodes`).then((r) => ({ brain: b, nodes: r.nodes || [] })))
        );
      })
      .then((combined) => {
        if (!combined) return;
        const allNodes = [];
        const seen = new Set();
        EXAMPLE_NODES.forEach((n) => {
          allNodes.push({ ...n, isExample: true });
          seen.add(n.id);
        });
        combined.forEach(({ brain, nodes: brainNodes }) => {
          brainNodes.forEach((n) => {
            if (seen.has(n.id)) return;
            seen.add(n.id);
            allNodes.push({
              ...n,
              brain_name: brain.name,
              isExample: false,
            });
          });
        });
        setNodes(allNodes.length > 0 ? allNodes : EXAMPLE_NODES);
      })
      .catch(() => setNodes(EXAMPLE_NODES))
      .finally(() => setLoading(false));
  }, []);

  // Simple layout: place nodes in a row or grid; Welcome left, Getting started right, then others
  const getPosition = (node, index) => {
    const total = nodes.length;
    if (node.id === 'welcome') return { x: 160, y: 200 };
    if (node.id === 'getting-started') return { x: 380, y: 200 };
    const row = Math.floor(index / 4);
    const col = index % 4;
    return { x: 140 + col * 120, y: 320 + row * 100 };
  };

  const nodePositions = {};
  nodes.forEach((n, i) => {
    nodePositions[n.id] = getPosition(n, i);
  });

  const edges = [];
  nodes.forEach((n) => {
    (n.related_node_ids || []).forEach((targetId) => {
      if (nodePositions[n.id] && nodePositions[targetId]) {
        edges.push({ from: n.id, to: targetId });
      }
    });
  });

  if (loading) {
    return (
      <div className="w-full h-full min-h-[500px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl flex items-center justify-center">
        <p className="text-[rgb(var(--muted))]">Loading graph…</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[rgb(var(--border))]">
        <h2 className="text-sm font-medium text-[rgb(var(--text))]">Knowledge graph</h2>
        <span className="text-xs text-[rgb(var(--muted))]">{nodes.length} nodes</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <svg
          viewBox="0 0 520 420"
          className="w-full max-w-2xl h-full max-h-[400px]"
          style={{ minHeight: 360 }}
        >
          {edges.map((e) => (
            <Edge
              key={`${e.from}-${e.to}`}
              x1={nodePositions[e.from]?.x ?? 0}
              y1={nodePositions[e.from]?.y ?? 0}
              x2={nodePositions[e.to]?.x ?? 0}
              y2={nodePositions[e.to]?.y ?? 0}
            />
          ))}
          {nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            return (
              <NodeCircle
                key={node.id}
                node={node}
                x={pos.x}
                y={pos.y}
                isHighlighted={highlightId === node.id}
                onClick={setHighlightId}
              />
            );
          })}
        </svg>
      </div>
      {highlightId && (
        <div className="px-4 py-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--panel2))] text-sm text-[rgb(var(--text))]">
          {nodes.find((n) => n.id === highlightId)?.summary || '—'}
        </div>
      )}
    </div>
  );
}
