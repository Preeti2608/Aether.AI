import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

// ── Chat ─────────────────────────────────────────────────────────────────────
export const chatApi = {
  getSessions: () => api.get('/chat/sessions'),
  createSession: (data: { title?: string; model?: string }) => api.post('/chat/sessions', data),
  deleteSession: (id: string) => api.delete(`/chat/sessions/${id}`),
  updateTitle: (id: string, title: string) => api.patch(`/chat/sessions/${id}/title`, { title }),
  getMessages: (sessionId: string) => api.get(`/chat/sessions/${sessionId}/messages`),
  sendMessage: (data: {
    content: string
    session_id?: string
    model?: string
    use_memory?: boolean
    use_rag?: boolean
    document_id?: string
  }) => api.post('/chat/send', data),
}

// ── Memory ────────────────────────────────────────────────────────────────────
export const memoryApi = {
  list: (params?: { category?: string; collection_id?: string }) =>
    api.get('/memories/', { params }),
  create: (data: {
    content: string
    category?: string
    collection_id?: string
    tags?: string
    source?: string
  }) => api.post('/memories/', data),
  update: (id: string, data: Partial<{ content: string; category: string; tags: string; is_pinned: boolean }>) =>
    api.patch(`/memories/${id}`, data),
  delete: (id: string) => api.delete(`/memories/${id}`),
  search: (q: string, limit?: number) => api.get('/memories/search', { params: { q, limit } }),
  stats: () => api.get('/memories/stats/summary'),
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export const notesApi = {
  list: (params?: { collection_id?: string; tag?: string }) =>
    api.get('/notes/', { params }),
  create: (data: { title: string; content?: string; tags?: string; collection_id?: string; color?: string }) =>
    api.post('/notes/', data),
  get: (id: string) => api.get(`/notes/${id}`),
  update: (id: string, data: Partial<{ title: string; content: string; tags: string; is_pinned: boolean; color: string; collection_id: string }>) =>
    api.patch(`/notes/${id}`, data),
  delete: (id: string) => api.delete(`/notes/${id}`),
  search: (q: string) => api.get('/notes/search', { params: { q } }),
  aiAction: (id: string, action: string, model?: string) =>
    api.post(`/notes/${id}/ai`, { action, model }),
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsApi = {
  list: () => api.get('/documents/'),
  upload: (file: File, collectionId?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (collectionId) fd.append('collection_id', collectionId)
    return api.post('/documents/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  get: (id: string) => api.get(`/documents/${id}`),
  delete: (id: string) => api.delete(`/documents/${id}`),
  chat: (id: string, question: string, model?: string) =>
    api.post(`/documents/${id}/chat`, { question, model }),
  summarize: (id: string, model?: string) =>
    api.post(`/documents/${id}/summarize`, null, { params: { model } }),
}

// ── Collections ───────────────────────────────────────────────────────────────
export const collectionsApi = {
  list: () => api.get('/collections/'),
  create: (data: { name: string; description?: string; icon?: string; color?: string }) =>
    api.post('/collections/', data),
  update: (id: string, data: Partial<{ name: string; description: string; icon: string; color: string }>) =>
    api.patch(`/collections/${id}`, data),
  delete: (id: string) => api.delete(`/collections/${id}`),
}

// ── Search ────────────────────────────────────────────────────────────────────
export const searchApi = {
  search: (q: string, types?: string, limit?: number) =>
    api.get('/search/', { params: { q, types, limit } }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getSettings: () => api.get('/settings/'),
  getModels: () => api.get('/settings/models'),
  exportData: () => api.post('/settings/export'),
  clearMemory: () => api.post('/settings/clear-memory'),
  reset: () => api.post('/settings/reset'),
}
