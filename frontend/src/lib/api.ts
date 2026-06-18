const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

function wsjtxReplyMode(mode: string) {
  const normalized = mode.toUpperCase()
  if (normalized === 'FT8') return '~'
  if (normalized === 'FT4') return '+'
  return mode
}

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
  if (res.status === 204 || res.status === 202) return undefined as T
  return res.json()
}

function queryString(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
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
    changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      request<void>('/api/users/me/password', { method: 'PUT', body: JSON.stringify(data) }),
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
    getDuplicates: () => request<import('./types').QsoDuplicateGroup[]>('/api/qsos/duplicates'),
    mergeDuplicate: (data: { keepId: number; duplicateIds: number[] }) =>
      request<import('./types').Qso>('/api/qsos/duplicates/merge', { method: 'POST', body: JSON.stringify(data) }),
    getById: (id: number) => request<import('./types').Qso>(`/api/qsos/${id}`),
    getExternalStatus: (id: number) => request<import('./types').QsoExternalLogStatus[]>(`/api/qsos/${id}/external-status`),
    getConditions: (id: number) => request<import('./types').QsoConditions>(`/api/qsos/${id}/conditions`),
    sendToEqsl: (id: number) => request<{ success: boolean; message: string; eqslSentAt: string }>(`/api/qsos/${id}/eqsl/send`, { method: 'POST' }),
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
      return res.json() as Promise<{ imported: number; skipped: number; merged: number }>
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
  awards: {
    getCatalog: () => request<import('./types').AwardCatalogItem[]>('/api/awards/catalog'),
    getSummary: (filters: import('./types').AwardFilters = {}) =>
      request<import('./types').AwardSummaryResponse>(`/api/awards/summary${queryString(filters as Record<string, string | number | undefined | null>)}`),
    getDetail: (id: string, filters: import('./types').AwardFilters = {}) =>
      request<import('./types').AwardDetailResponse>(`/api/awards/${encodeURIComponent(id)}${queryString(filters as Record<string, string | number | undefined | null>)}`),
    backfill: (dryRun = false) =>
      request<import('./types').AwardBackfillResult>('/api/awards/backfill', { method: 'POST', body: JSON.stringify({ dryRun }) }),
  },
  spots: {
    getLatest: (limit = 50) => request<import('./types').DxSpot[]>(`/api/spots?limit=${limit}`),
    getCluster: (limit = 30) => request<import('./types').ClusterSpot[]>(`/api/spots/cluster?limit=${limit}`),
    getById: (id: number) => request<import('./types').DxSpot>(`/api/spots/${id}`),
    create: (data: Partial<import('./types').DxSpot>) =>
      request<import('./types').DxSpot>('/api/spots', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/spots/${id}`, { method: 'DELETE' }),
  },
  pota: {
    getSpots: () => request<import('./types').PotaSpot[]>('/api/pota/spots'),
  },
  propagation: {
    live: () => request<import('./types').QsoMufFof2>('/api/propagation/live'),
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
    importFeeds: () => request<import('./types').ArticleFeedImportResult>('/api/articles/import-feeds', { method: 'POST' }),
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
    reports: (status?: import('./types').ReportStatus) =>
      request<import('./types').ContentReport[]>(`/api/admin/reports${status ? `?status=${status}` : ''}`),
    resolveReport: (id: number) => request<void>(`/api/admin/reports/${id}/resolve`, { method: 'POST' }),
    dismissReport: (id: number) => request<void>(`/api/admin/reports/${id}/dismiss`, { method: 'POST' }),
  },
  listings: {
    getAll: (category?: number, search?: string) => {
      const params = new URLSearchParams()
      if (category) params.set('category', String(category))
      if (search) params.set('search', search)
      const qs = params.toString()
      return request<import('./types').Listing[]>(`/api/listings${qs ? `?${qs}` : ''}`)
    },
    getMine: () => request<import('./types').Listing[]>('/api/listings/my'),
    getById: (id: number) => request<import('./types').Listing>(`/api/listings/${id}`),
    create: (data: { title: string; description: string; price: number; currency: string; category: number; condition: number }) =>
      request<import('./types').Listing>('/api/listings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { title: string; description: string; price: number; currency: string; category: number; condition: number }) =>
      request<import('./types').Listing>(`/api/listings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    markSold: (id: number) => request<void>(`/api/listings/${id}/sold`, { method: 'POST' }),
    delete: (id: number) => request<void>(`/api/listings/${id}`, { method: 'DELETE' }),
    uploadImage: async (id: number, file: File) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API_URL}/api/listings/${id}/images`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`)
      return res.json() as Promise<{ id: number; url: string }>
    },
    deleteImage: (listingId: number, imageId: number) =>
      request<void>(`/api/listings/${listingId}/images/${imageId}`, { method: 'DELETE' }),
  },
  messages: {
    getInbox: () => request<import('./types').Message[]>('/api/messages/inbox'),
    getSent: () => request<import('./types').Message[]>('/api/messages/sent'),
    getUnreadCount: () => request<{ count: number }>('/api/messages/unread-count'),
    getById: (id: number) => request<import('./types').Message>(`/api/messages/${id}`),
    getConversation: (userId: string) => request<import('./types').Message[]>(`/api/messages/conversation/${userId}`),
    send: (data: { recipientId: string; subject: string; body: string }) =>
      request<import('./types').Message>('/api/messages', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/messages/${id}`, { method: 'DELETE' }),
  },
  notifications: {
    summary: () => request<import('./types').NotificationSummary>('/api/notifications/summary'),
  },
  safety: {
    getBlockedUsers: () => request<import('./types').BlockedUser[]>('/api/safety/blocks'),
    blockUser: (userId: string) => request<void>('/api/safety/blocks', { method: 'POST', body: JSON.stringify({ userId }) }),
    unblockUser: (userId: string) => request<void>(`/api/safety/blocks/${userId}`, { method: 'DELETE' }),
    report: (data: { targetType: string; targetUserId?: string | null; targetId?: number | null; reason: string }) =>
      request<import('./types').ContentReport>('/api/safety/reports', { method: 'POST', body: JSON.stringify(data) }),
  },
  friends: {
    getAll: () => request<import('./types').Friendship[]>('/api/friends'),
    getRequests: () => request<import('./types').FriendRequests>('/api/friends/requests'),
    search: (q: string) => request<import('./types').FriendCandidate[]>(`/api/friends/search?q=${encodeURIComponent(q)}`),
    sendRequest: (userId: string) =>
      request<import('./types').Friendship>('/api/friends/requests', { method: 'POST', body: JSON.stringify({ userId }) }),
    accept: (id: number) => request<import('./types').Friendship>(`/api/friends/requests/${id}/accept`, { method: 'POST' }),
    decline: (id: number) => request<import('./types').Friendship>(`/api/friends/requests/${id}/decline`, { method: 'POST' }),
    remove: (friendId: string) => request<void>(`/api/friends/${friendId}`, { method: 'DELETE' }),
  },
  community: {
    getRooms: () => request<import('./types').CommunityRoom[]>('/api/community/rooms'),
    getGroups: () => request<import('./types').CommunityRoom[]>('/api/community/groups'),
    getForumRooms: () => request<import('./types').CommunityRoom[]>('/api/community/forum-rooms'),
    createGroup: (data: { name: string; description?: string | null; visibility: number; allowJoinRequests: boolean }) =>
      request<import('./types').CommunityRoom>('/api/community/groups', { method: 'POST', body: JSON.stringify(data) }),
    requestToJoinGroup: (groupId: number) =>
      request<void>(`/api/community/groups/${groupId}/join-requests`, { method: 'POST' }),
    getGroupJoinRequests: (groupId: number) =>
      request<import('./types').CommunityGroupJoinRequest[]>(`/api/community/groups/${groupId}/join-requests`),
    approveGroupJoinRequest: (groupId: number, requestId: number) =>
      request<void>(`/api/community/groups/${groupId}/join-requests/${requestId}/approve`, { method: 'POST' }),
    inviteToGroup: (groupId: number, userId: string) =>
      request<void>(`/api/community/groups/${groupId}/invite`, { method: 'POST', body: JSON.stringify({ userId }) }),
    getGroupInvitations: () =>
      request<import('./types').CommunityGroupInvitation[]>('/api/community/group-invitations'),
    acceptGroupInvitation: (invitationId: number) =>
      request<void>(`/api/community/group-invitations/${invitationId}/accept`, { method: 'POST' }),
    getContacts: () => request<import('./types').CommunityContact[]>('/api/community/contacts'),
    getOnlineUsers: () => request<import('./types').CommunityOnlineUser[]>('/api/community/online'),
  },
  chat: {
    getRoomMessages: (roomSlug: string, limit = 60) =>
      request<import('./types').ChatMessage[]>(
        `/api/chat/rooms/${encodeURIComponent(roomSlug)}/messages?limit=${limit}`
      ),
    sendRoomMessage: (roomSlug: string, content: string) =>
      request<import('./types').ChatMessage>(
        `/api/chat/rooms/${encodeURIComponent(roomSlug)}/messages`,
        { method: 'POST', body: JSON.stringify({ content }) }
      ),
  },
  posts: {
    getFeed: (page = 1, roomSlug?: string, search?: string, tag?: string, solved?: boolean, scope?: 'community' | 'forum') =>
      request<{ total: number; page: number; pageSize: number; items: import('./types').Post[] }>(
        `/api/posts${queryString({ page, room: roomSlug, search, tag, solved: solved === undefined ? undefined : String(solved), scope })}`
      ),
    getById: (id: number) => request<import('./types').Post>(`/api/posts/${id}`),
    create: (content: string, roomSlug?: string, title?: string, tags?: string) =>
      request<import('./types').Post>('/api/posts', { method: 'POST', body: JSON.stringify({ content, roomSlug, title, tags }) }),
    delete: (id: number) => request<void>(`/api/posts/${id}`, { method: 'DELETE' }),
    toggleLike: (id: number) => request<{ liked: boolean }>(`/api/posts/${id}/like`, { method: 'POST' }),
    setSolved: (id: number, isSolved: boolean) =>
      request<import('./types').Post>(`/api/posts/${id}/solved`, { method: 'POST', body: JSON.stringify({ isSolved }) }),
    getComments: (id: number) => request<import('./types').PostComment[]>(`/api/posts/${id}/comments`),
    addComment: (id: number, content: string) =>
      request<import('./types').PostComment>(`/api/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    deleteComment: (postId: number, commentId: number) =>
      request<void>(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
    uploadImage: async (postId: number, file: File) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API_URL}/api/posts/${postId}/images`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`)
      return res.json() as Promise<{ id: number; url: string }>
    },
  },
  qrz: {
    lookup: (callsign: string) =>
      request<import('./types').QrzCallsignInfo>(`/api/qrz/lookup?callsign=${encodeURIComponent(callsign)}`),
    status: () =>
      request<import('./types').QrzStatus>('/api/qrz/status'),
    sync: () =>
      request<void>('/api/qrz/sync', { method: 'POST' }),
    reconciliation: () =>
      request<import('./types').QrzReconciliationResponse>('/api/qrz/reconciliation'),
    applyReconciliation: (data: import('./types').QrzReconciliationApplyRequest) =>
      request<import('./types').QrzReconciliationApplyResponse>('/api/qrz/reconciliation/apply', { method: 'POST', body: JSON.stringify(data) }),
    deleteDuplicate: (data: import('./types').QrzDuplicateDeleteRequest) =>
      request<import('./types').QrzDuplicateDeleteResponse>('/api/qrz/reconciliation/duplicates/delete', { method: 'POST', body: JSON.stringify(data) }),
    saveKey: (apiKey: string) =>
      request<{ callsign: string | null }>('/api/users/me/qrz-key', { method: 'PUT', body: JSON.stringify({ apiKey }) }),
    saveCredentials: (username: string, password: string) =>
      request<{ username: string }>('/api/users/me/qrz-credentials', { method: 'PUT', body: JSON.stringify({ username, password }) }),
  },
  lotw: {
    activity: (callsigns: string[]) =>
      request<import('./types').LotwActivity[]>(
        `/api/lotw/activity?callsigns=${encodeURIComponent(callsigns.join(','))}`
      ),
    status: () =>
      request<import('./types').LotwStatus>('/api/lotw/status'),
    sync: () =>
      request<import('./types').LotwSyncResult>('/api/lotw/sync', { method: 'POST' }),
    saveCredentials: (username: string, password: string) =>
      request<{ username: string }>('/api/users/me/lotw-credentials', {
        method: 'PUT',
        body: JSON.stringify({ username, password }),
      }),
  },
  wsjtx: {
    getRecentDecodes: (limit = 200) =>
      request<import('./types').WsjtxDecodeItem[]>(`/api/wsjtx/decodes?limit=${limit}`),
    callDecode: (decode: import('./types').WsjtxDecodeItem) =>
      request<{ id: string; type: string }>('/api/wsjtx/commands/reply', {
        method: 'POST',
        body: JSON.stringify({
          wsjtxId: decode.wsjtxId,
          timeMs: decode.wsjtxTimeMs,
          snr: decode.snr,
          deltaTime: decode.deltaTime,
          deltaFreqHz: decode.deltaFreqHz,
          mode: wsjtxReplyMode(decode.mode),
          message: decode.message,
          lowConfidence: decode.lowConfidence,
        }),
      }),
    stopTx: () =>
      request<{ id: string; type: string }>('/api/wsjtx/commands/stop', { method: 'POST' }),
    getCommandResults: () =>
      request<import('./types').WsjtxCommandResult[]>('/api/wsjtx/commands/results'),
    getStatus: async () =>
      (await request<import('./types').WsjtxStatus | undefined>('/api/wsjtx/status')) ?? null,
    getAgentStatus: () =>
      request<import('./types').WsjtxAgentStatus>('/api/wsjtx/agent-status'),
  },
  eqsl: {
    status: () =>
      request<import('./types').EqslStatus>('/api/eqsl/status'),
    saveCredentials: (username: string, password: string, qthNickname?: string) =>
      request<{ username: string; qthNickname: string | null }>('/api/users/me/eqsl-credentials', {
        method: 'PUT',
        body: JSON.stringify({ username, password, qthNickname }),
      }),
  },
}
