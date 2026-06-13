const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<import('./types').AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (data: { email: string; password: string; callsign?: string; firstName?: string; lastName?: string }) =>
      request<import('./types').AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  },
  users: {
    me: () => request<import('./types').User>('/api/users/me'),
    getById: (id: string) => request<import('./types').User>(`/api/users/${id}`),
    updateMe: (data: Partial<import('./types').User>) =>
      request<import('./types').User>('/api/users/me', { method: 'PUT', body: JSON.stringify(data) }),
    getAll: () => request<import('./types').User[]>('/api/users'),
    searchByCallsign: (callsign: string) => request<import('./types').User>(`/api/users/search?callsign=${encodeURIComponent(callsign)}`),
  },
  stations: {
    getAll: () => request<import('./types').Station[]>('/api/stations'),
    getMine: () => request<import('./types').Station[]>('/api/stations/my'),
    getById: (id: number) => request<import('./types').Station>(`/api/stations/${id}`),
    create: (data: Partial<import('./types').Station>) =>
      request<import('./types').Station>('/api/stations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<import('./types').Station>) =>
      request<import('./types').Station>(`/api/stations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/stations/${id}`, { method: 'DELETE' }),
  },
  qsos: {
    getMine: (search?: string) => request<import('./types').Qso[]>(`/api/qsos${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    getById: (id: number) => request<import('./types').Qso>(`/api/qsos/${id}`),
    create: (data: Partial<import('./types').Qso>) =>
      request<import('./types').Qso>('/api/qsos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<import('./types').Qso>) =>
      request<import('./types').Qso>(`/api/qsos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/qsos/${id}`, { method: 'DELETE' }),
    importAdif: async (file: File) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API_URL}/api/qsos/import/adif`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`)
      return res.json() as Promise<{ imported: number; skipped: number }>
    },
    exportAdif: async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch(`${API_URL}/api/qsos/export/adif`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const filename = res.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `hamhub-logbog-${new Date().toISOString().slice(0, 10)}.adi`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    },
  },
  spots: {
    getLatest: (limit = 50) => request<import('./types').DxSpot[]>(`/api/spots?limit=${limit}`),
    getCluster: (limit = 30) => request<import('./types').ClusterSpot[]>(`/api/spots/cluster?limit=${limit}`),
    getById: (id: number) => request<import('./types').DxSpot>(`/api/spots/${id}`),
    create: (data: Partial<import('./types').DxSpot>) =>
      request<import('./types').DxSpot>('/api/spots', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/spots/${id}`, { method: 'DELETE' }),
  },
  articles: {
    getPublished: () => request<import('./types').Article[]>('/api/articles'),
    getAll: () => request<import('./types').Article[]>('/api/articles/all'),
    getById: (id: number) => request<import('./types').Article>(`/api/articles/${id}`),
    getBySlug: (slug: string) => request<import('./types').Article>(`/api/articles/${slug}`),
    getCategories: () => request<import('./types').ArticleCategory[]>('/api/articles/categories'),
    create: (data: { title: string; slug: string; summary?: string; content: string; categoryId: number }) =>
      request<import('./types').Article>('/api/articles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { title: string; slug: string; summary?: string; content: string; categoryId: number }) =>
      request<import('./types').Article>(`/api/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    publish: (id: number) => request<void>(`/api/articles/${id}/publish`, { method: 'POST' }),
    delete: (id: number) => request<void>(`/api/articles/${id}`, { method: 'DELETE' }),
  },
  comments: {
    getForArticle: (articleId: number) => request<import('./types').ArticleComment[]>(`/api/articles/${articleId}/comments`),
    create: (articleId: number, content: string) =>
      request<import('./types').ArticleComment>(`/api/articles/${articleId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    delete: (articleId: number, commentId: number) =>
      request<void>(`/api/articles/${articleId}/comments/${commentId}`, { method: 'DELETE' }),
  },
  admin: {
    dashboard: () => request<import('./types').DashboardStats>('/api/admin/dashboard'),
    stats: () => request<import('./types').DashboardStats>('/api/admin/stats'),
  },
}
