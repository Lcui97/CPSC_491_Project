import { create } from 'zustand';
import { api } from '../api/client';

/** Lightweight client-side cache so context panels don’t hammer list endpoints. */
export const useBrainStore = create((set) => ({
  nodeListCache: {},
  nodeCache: {},
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

  fetchNode: async (nodeId) => {
    const node = await api(`/api/nodes/${nodeId}`);
    set((s) => ({ nodeCache: { ...s.nodeCache, [nodeId]: node } }));
    return node;
  },

  updateNode: async (nodeId, body) => {
    const node = await api(`/api/nodes/${nodeId}`, { method: 'PUT', body: JSON.stringify(body) });
    set((s) => ({
      nodeCache: { ...s.nodeCache, [nodeId]: node },
      nodeListCache: {},
    }));
    return node;
  },

  fetchBacklinks: (nodeId) => api(`/api/nodes/${nodeId}/backlinks`),
  fetchRelated: (nodeId) => api(`/api/nodes/${nodeId}/related`),

  invalidateBrain: (brainId) => {
    set((s) => {
      const next = { ...s.nodeListCache };
      delete next[brainId];
      return { nodeListCache: next };
    });
  },
}));
