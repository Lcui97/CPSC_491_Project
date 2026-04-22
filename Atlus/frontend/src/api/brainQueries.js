import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiUpload, apiUploadWithProgress } from './client';

export const brainKeys = {
  list: () => ['brains'],
  nodes: (brainId, params) => ['brains', brainId, 'nodes', params],
  node: (nodeId) => ['nodes', nodeId],
  meSummary: () => ['me', 'summary'],
  meActivity: (limit) => ['me', 'activity', limit],
  meNotes: (params) => ['me', 'notes', params],
  sources: (brainId) => ['brains', brainId, 'sources'],
  calendarGlobal: (params) => ['calendar-events', params],
  classes: () => ['classes'],
  syllabusPreview: (classId) => ['classes', classId, 'syllabus-preview'],
};

export function useBrains() {
  return useQuery({
    queryKey: brainKeys.list(),
    queryFn: () =>
      api('/api/brain/list').then((r) => {
        const b = r?.brains;
        return Array.isArray(b) ? b : [];
      }),
    select: (d) => (Array.isArray(d) ? d : []),
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

export function useMeSummary() {
  return useQuery({
    queryKey: brainKeys.meSummary(),
    queryFn: () => api('/api/me/summary'),
  });
}

export function useMeActivity(limit = 8) {
  return useQuery({
    queryKey: brainKeys.meActivity(limit),
    queryFn: () => api(`/api/me/activity?limit=${limit}`).then((r) => r.items || []),
  });
}

export function useAllMyNotes(params = {}) {
  const { page = 1, per_page = 48, q = '' } = params;
  const notesKey = ['me', 'notes', { page, per_page, q }];
  return useQuery({
    queryKey: notesKey,
    queryFn: () => {
      const search = new URLSearchParams({ page: String(page), per_page: String(per_page) });
      if (q) search.set('q', q);
      return api(`/api/me/notes?${search}`);
    },
  });
}

export function useDeleteNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId }) => api(`/api/nodes/${nodeId}`, { method: 'DELETE' }),
    onSuccess: (_data, { nodeId, brainId }) => {
      queryClient.removeQueries({ queryKey: brainKeys.node(nodeId) });
      queryClient.invalidateQueries({ queryKey: ['me', 'notes'] });
      queryClient.invalidateQueries({ queryKey: brainKeys.meSummary() });
      queryClient.invalidateQueries({ queryKey: brainKeys.list() });
      if (brainId) {
        queryClient.invalidateQueries({ queryKey: ['brains', brainId, 'nodes'] });
        queryClient.invalidateQueries({ queryKey: brainKeys.sources(brainId) });
      }
    },
  });
}

export function useDeleteBrain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (brainId) => api(`/api/brain/${brainId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brainKeys.list() });
      queryClient.invalidateQueries({ queryKey: brainKeys.classes() });
      queryClient.invalidateQueries({ queryKey: ['me', 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'activity'] });
      queryClient.invalidateQueries({ queryKey: brainKeys.meSummary() });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useLeaveBrain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (brainId) => api(`/api/brain/${brainId}/leave`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brainKeys.list() });
    },
  });
}

export function useUpdateNode(nodeId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api(`/api/nodes/${nodeId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (data) => {
      queryClient.setQueryData(brainKeys.node(nodeId), data);
      queryClient.invalidateQueries({ queryKey: ['brains'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'notes'] });
      if (data?.brain_id) {
        queryClient.invalidateQueries({ queryKey: ['brains', data.brain_id] });
      }
    },
  });
}

export function useCreateNode(brainId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api(`/api/brain/${brainId}/nodes`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brains', brainId] });
      queryClient.invalidateQueries({ queryKey: ['brains', brainId, 'nodes'] });
      queryClient.invalidateQueries({ queryKey: brainKeys.meSummary() });
    },
  });
}

export function useDeleteSource(brainId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId) => api(`/api/brain/${brainId}/sources/${sourceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brainKeys.sources(brainId) });
      queryClient.invalidateQueries({ queryKey: ['brains', brainId] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: brainKeys.meSummary() });
    },
  });
}

export function useBrainSources(brainId) {
  return useQuery({
    queryKey: brainKeys.sources(brainId),
    queryFn: () => api(`/api/brain/${brainId}/sources`).then((r) => r.sources || []),
    enabled: !!brainId,
  });
}

export function useBrainAsk(brainId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => {
      if (!brainId) {
        return Promise.reject(new Error('Select a class in the sidebar first.'));
      }
      return api(`/api/brain/${brainId}/ask`, { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brainKeys.sources(brainId) });
      queryClient.invalidateQueries({ queryKey: brainKeys.nodes(brainId, {}) });
    },
  });
}

export function useGlobalCalendarEvents(params = {}) {
  const { start = '', end = '', type = '' } = params;
  return useQuery({
    queryKey: brainKeys.calendarGlobal({ start, end, type }),
    queryFn: () => {
      const search = new URLSearchParams();
      if (start) search.set('start', start);
      if (end) search.set('end', end);
      if (type) search.set('type', type);
      return api(`/api/calendar-events${search.toString() ? `?${search}` : ''}`).then((r) => r.events || []);
    },
  });
}

export function useUploadSyllabus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brainId, file }) => apiUpload('/api/brain/syllabus', { brain_id: brainId }, file),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['brains', vars?.brainId, 'calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      if (vars?.brainId) {
        queryClient.invalidateQueries({ queryKey: brainKeys.sources(vars.brainId) });
      }
    },
  });
}

export function useClasses() {
  return useQuery({
    queryKey: brainKeys.classes(),
    queryFn: () => api('/api/classes').then((r) => r.classes || []),
  });
}

export function useCreateClassManual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('/api/classes/manual', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brainKeys.classes() });
      queryClient.invalidateQueries({ queryKey: brainKeys.list() });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useCreateClassFromSyllabus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }) => apiUploadWithProgress('/api/classes/syllabus', {}, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brainKeys.classes() });
      queryClient.invalidateQueries({ queryKey: brainKeys.list() });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useClassesAssistant() {
  return useMutation({
    mutationFn: ({ prompt, signal, ...rest }) =>
      api('/api/classes/assistant', {
        method: 'POST',
        body: JSON.stringify({ prompt, ...rest }),
        signal,
      }),
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, body }) => api(`/api/classes/${classId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brainKeys.classes() });
      queryClient.invalidateQueries({ queryKey: brainKeys.list() });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useClassSyllabusPreview(classId, enabled = true) {
  return useQuery({
    queryKey: brainKeys.syllabusPreview(classId),
    queryFn: () => api(`/api/classes/${classId}/syllabus-preview`),
    enabled: !!classId && enabled,
  });
}
