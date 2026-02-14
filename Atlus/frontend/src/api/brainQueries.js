import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const brainKeys = {
  list: () => ['brains'],
  nodes: (brainId, params) => ['brains', brainId, 'nodes', params],
  node: (nodeId) => ['nodes', nodeId],
  graph: (brainId) => ['brains', brainId, 'graph'],
  globalGraph: () => ['graph', 'global'],
  meSummary: () => ['me', 'summary'],
};

export function useBrains() {
  return useQuery({
    queryKey: brainKeys.list(),
    queryFn: () => api('/api/brain/list').then((r) => r.brains || []),
  });
}

export function useBrainNodes(brainId, params = {}) {
  const { page = 1, per_page = 50, q = '', tag = '', sort = 'recent' } = params;
  return useQuery({
    queryKey: brainKeys.nodes(brainId, { page, per_page, q, tag, sort }),
    queryFn: () => {
      const search = new URLSearchParams({ page, per_page });
      if (q) search.set('q', q);
      if (tag) search.set('tag', tag);
      if (sort) search.set('sort', sort);
      return api(`/api/brain/${brainId}/nodes?${search}`);
    },
    enabled: !!brainId,
  });
}

export function useNode(nodeId) {
  return useQuery({
    queryKey: brainKeys.node(nodeId),
    queryFn: () => api(`/api/nodes/${nodeId}`),
    enabled: !!nodeId,
  });
}

export function useBrainGraph(brainId) {
  return useQuery({
    queryKey: brainKeys.graph(brainId),
    queryFn: () => api(`/api/brain/${brainId}/graph`),
    enabled: !!brainId,
  });
}

export function useGlobalGraph() {
  return useQuery({
    queryKey: brainKeys.globalGraph(),
    queryFn: () => api('/api/graph/global'),
  });
}

export function useMeSummary() {
  return useQuery({
    queryKey: brainKeys.meSummary(),
    queryFn: () => api('/api/me/summary'),
  });
}

export function useUpdateNode(nodeId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api(`/api/nodes/${nodeId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (data) => {
      queryClient.setQueryData(brainKeys.node(nodeId), data);
      queryClient.invalidateQueries({ queryKey: ['brains'] });
    },
  });
}

export function useCreateNode(brainId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api(`/api/brain/${brainId}/nodes`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brains', brainId] });
      queryClient.invalidateQueries({ queryKey: brainKeys.globalGraph() });
      queryClient.invalidateQueries({ queryKey: brainKeys.meSummary() });
    },
  });
}
