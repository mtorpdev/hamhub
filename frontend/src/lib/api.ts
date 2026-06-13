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
  },
  spots: {
    getLatest: (limit = 50) => request<import('./types').DxSpot[]>(`/api/spots?limit=${limit}`),
    getById: (id: number) => request<import('./types').DxSpot>(`/api/spots/${id}`),
    create: (data: Partial<import('./types').DxSpot>) =>
      request<import('./types').DxSpot>('/api/spots', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/spots/${id}`, { method: 'DELETE' }),
  },
  articles: {
    getPublished: () => request<import('./types').Article[]>('/api/articles'),
    getAll: () => request<import('./types').Article[]>('/api/articles/all'),
    getBySlug: (slug: string) => request<import('./types').Article>(`/api/articles/${slug}`),
    create: (data: { title: string; slug: string; summary?: string; content: string; categoryId: number }) =>
      request<import('./types').Article>('/api/articles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { title: string; slug: string; summary?: string; content: string; categoryId: number }) =>
      request<import('./types').Article>(`/api/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    publish: (id: number) => request<void>(`/api/articles/${id}/publish`, { method: 'POST' }),
    delete: (id: number) => request<void>(`/api/articles/${id}`, { method: 'DELETE' }),
  },
  admin: {
    dashboard: () => request<import('./types').DashboardStats>('/api/admin/dashboard'),
  },
}
