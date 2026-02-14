import { create } from 'zustand';
import { api } from '../api/client';

/**
 * Global cache for brain nodes and graph data. Obsidian-style: load once, cache.
 */
export const useBrainStore = create((set, get) => ({
  // brainId -> { nodes: [], total, page, per_page } (list cache)
  nodeListCache: {},
  // brainId -> { nodes: [], edges: [] } (graph cache)
  graphCache: {},
  // nodeId -> node (single node cache)
  nodeCache: {},
  // brainId -> brain info
  brainCache: {},

  fetchBrain: async (brainId) => {
    const list = await api('/api/brain/list');
    const brain = (list.brains || []).find((b) => b.id === brainId);
    if (brain) set((s) => ({ brainCache: { ...s.brainCache, [brainId]: brain } }));
    return brain;
  },

  fetchNodes: async (brainId, { page = 1, per_page = 50, q = '', tag = '', sort = 'recent' } = {}) => {
    const params = new URLSearchParams({ page, per_page });
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);
    if (sort) params.set('sort', sort);
    const data = await api(`/api/brain/${brainId}/nodes?${params}`);
    set((s) => ({
      nodeListCache: {
        ...s.nodeListCache,
        [brainId]: { nodes: data.nodes, total: data.total, page: data.page, per_page: data.per_page },
      },
    }));
    return data;
  },

  fetchGraph: async (brainId) => {
    const data = await api(`/api/brain/${brainId}/graph`);
    set((s) => ({
      graphCache: { ...s.graphCache, [brainId]: { nodes: data.nodes, edges: data.edges } },
    }));
    return data;
  },

  getGraph: (brainId) => get().graphCache[brainId] || null,

  fetchNode: async (nodeId) => {
    const node = await api(`/api/nodes/${nodeId}`);
    set((s) => ({ nodeCache: { ...s.nodeCache, [nodeId]: node } }));
    return node;
  },

  updateNode: async (nodeId, body) => {
    const node = await api(`/api/nodes/${nodeId}`, { method: 'PUT', body: JSON.stringify(body) });
    set((s) => ({
      nodeCache: { ...s.nodeCache, [nodeId]: node },
      nodeListCache: {}, // invalidate list caches so next open refetches
      graphCache: {},   // invalidate graph so it refetches
    }));
    return node;
  },

  fetchBacklinks: (nodeId) => api(`/api/nodes/${nodeId}/backlinks`),
  fetchRelated: (nodeId) => api(`/api/nodes/${nodeId}/related`),

  invalidateBrain: (brainId) => {
    set((s) => {
      const next = { ...s.nodeListCache };
      delete next[brainId];
      const nextGraph = { ...s.graphCache };
      delete nextGraph[brainId];
      return { nodeListCache: next, graphCache: nextGraph };
    });
  },
}));
