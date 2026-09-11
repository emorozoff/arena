// Настоящий сервер: HTTP-запросы к Node + SQLite и подписка на сигналы через SSE.
// Формы данных те же, что у игрушечного сервера (api.mock.ts).
import { ApiError, type ApiErrorCode, type GuestState, type LiveChannel } from '@shared/types'
import type { Api } from './api.types'

const TOKEN_KEY = 'arena_guest_token' // токен устройства зрителя; сервер ставит ещё и cookie

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // хранилище недоступно — останется cookie
  }
}

async function request<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const token = getToken()
  if (token) headers['x-guest-token'] = token

  let response: Response
  try {
    response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' })
  } catch {
    throw new ApiError('network')
  }
  // Сервер недоступен за прокси — это обрыв связи, действие надо повторить
  if (response.status === 502 || response.status === 503 || response.status === 504) throw new ApiError('network')

  const data = (await response.json().catch(() => ({}))) as { error?: ApiErrorCode }
  if (!response.ok) throw new ApiError(data.error ?? 'unknown')
  return data as T
}

// --- Реалтайм: одно SSE-соединение на страницу, переподключается само ---

const listeners: Record<LiveChannel, Set<() => void>> = { show: new Set(), totals: new Set() }
let source: EventSource | null = null

function notify(channel: LiveChannel) {
  listeners[channel].forEach((cb) => cb())
}

function ensureSource() {
  if (source) return
  source = new EventSource('/api/events')
  source.addEventListener('show', () => notify('show'))
  source.addEventListener('totals', () => notify('totals'))
  // После переподключения могли пропустить сигналы — обновляем всё
  source.addEventListener('hello', () => {
    notify('show')
    notify('totals')
  })
}

function closeSourceIfIdle() {
  if (source && listeners.show.size === 0 && listeners.totals.size === 0) {
    source.close()
    source = null
  }
}

export const httpApi: Api = {
  async join(ticket) {
    const state = await request<GuestState & { token: string }>('/api/join', 'POST', { ticket })
    setToken(state.token)
    return state
  },
  getMe: () => request<GuestState>('/api/me'),
  allocate: (projectId, amount) => request<GuestState>('/api/allocate', 'POST', { project_id: projectId, amount }),
  async logout() {
    setToken(null)
    await request('/api/logout', 'POST')
  },

  getScreen: () => request('/api/screen/state'),

  adminIsLoggedIn: async () => (await request<{ logged_in: boolean }>('/api/admin/session')).logged_in,
  adminLogin: async (password) => {
    await request('/api/admin/login', 'POST', { password })
  },
  adminOverview: () => request('/api/admin/overview'),
  adminUpdateShow: (patch) => request('/api/admin/show', 'POST', patch),
  adminAddProject: (name, speaker) => request('/api/admin/projects', 'POST', { name, speaker }),
  adminEditProject: (id, fields) => request(`/api/admin/projects/${id}`, 'PUT', fields),
  adminDeleteProject: (id) => request(`/api/admin/projects/${id}`, 'DELETE'),
  adminMoveProject: (id, direction) => request(`/api/admin/projects/${id}/move`, 'POST', { direction }),
  adminOpenProject: (id) => request(`/api/admin/projects/${id}/open`, 'POST'),
  adminCloseProject: (id) => request(`/api/admin/projects/${id}/close`, 'POST'),
  adminTickets: () => request('/api/admin/tickets'),
  adminImportTickets: async (text) => (await request<{ added: number }>('/api/admin/tickets/import', 'POST', { text })).added,
  adminGenerateTickets: async (count) => (await request<{ codes: string[] }>('/api/admin/tickets/generate', 'POST', { count })).codes,
  adminReleaseTicket: async (number) => {
    await request(`/api/admin/tickets/${encodeURIComponent(number)}/release`, 'POST')
  },
  adminReset: (scope) => request('/api/admin/reset', 'POST', { scope }),
  adminSeedDemo: () => request('/api/admin/seed-demo', 'POST'),

  subscribe(channel, callback) {
    listeners[channel].add(callback)
    ensureSource()
    return () => {
      listeners[channel].delete(callback)
      closeSourceIfIdle()
    }
  },
}
