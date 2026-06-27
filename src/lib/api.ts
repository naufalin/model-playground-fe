const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8008'
).replace(/\/$/, '')

export const TOKEN_STORAGE_KEY = 'model_playground_token'

// ── Types ────────────────────────────────────────────────────────────────────

export type TokenResponse = {
  access_token: string
  token_type: string
}

export type User = {
  id: string
  email: string
  display_name: string | null
}

export type Model = {
  id: string
  provider: string
  model_name: string
  display_name: string
  is_active: boolean
  supports_reasoning: boolean
  sort_order: number
  config: Record<string, unknown> | null
}

export type PlaygroundSession = {
  id: string
  title: string
  tools: string[] | null
  created_at: string | null
}

export type Message = {
  id: number
  role: string
  content: string
  latency_ms: number | null
  provider: string | null
  model: string | null
  usage: Record<string, unknown> | null
  thinking: Record<string, unknown> | null
  tool_name: string | null
  tool_call_id: string | null
  tool_input: Record<string, unknown> | null
  output_preview: string | null
  viz_html: string | null
  output_delta_count: number | null
  request_options: Record<string, unknown> | null
  created_at: string | null
}

export type Thread = {
  id: string
  provider: string
  model_name: string
  display_name: string
  messages: Message[]
}

export type PlaygroundDetail = {
  id: string
  title: string
  tools: string[] | null
  created_at: string | null
  threads: Thread[]
}

export type ModelsResponse = {
  models: Model[]
}

export type Tool = {
  name: string
  description: string
}

export type ToolsResponse = {
  tools: Tool[]
  total: number
}

export type PlaygroundListResponse = {
  sessions: PlaygroundSession[]
  total: number
}

export type DashboardData = {
  models: Model[]
  sessions: PlaygroundSession[]
  totalSessions: number
}

// ── Error ────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// ── Base request ─────────────────────────────────────────────────────────────

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers)

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.'

    try {
      const body = (await response.json()) as { detail?: unknown }

      if (typeof body.detail === 'string') {
        message = body.detail
      } else if (Array.isArray(body.detail)) {
        message = body.detail
          .map((item) =>
            typeof item === 'object' && item !== null && 'msg' in item
              ? String(item.msg)
              : 'Invalid input',
          )
          .join(', ')
      }
    } catch {
      message = response.statusText || message
    }

    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function login(email: string, password: string) {
  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function signup(email: string, password: string, displayName: string) {
  return apiRequest<User>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      display_name: displayName.trim() || null,
    }),
  })
}

export function getCurrentUser(token: string) {
  return apiRequest<User>('/auth/me', {}, token)
}

// ── Models ───────────────────────────────────────────────────────────────────

export function getModels(token: string) {
  return apiRequest<ModelsResponse>('/models', {}, token)
}

export function getTools(token: string) {
  return apiRequest<ToolsResponse>('/tools', {}, token)
}

// ── Playground CRUD ──────────────────────────────────────────────────────────

export function getPlaygroundSessions(token: string, limit = 20, offset = 0) {
  return apiRequest<PlaygroundListResponse>(
    `/playground?limit=${limit}&offset=${offset}`,
    {},
    token,
  )
}

export function getPlaygroundDetail(token: string, id: string) {
  return apiRequest<PlaygroundDetail>(`/playground/${id}`, {}, token)
}

export function createPlayground(
  token: string,
  title = 'New Playground',
  tools: string[] | null = null,
) {
  return apiRequest<PlaygroundSession>(
    '/playground',
    { method: 'POST', body: JSON.stringify({ title, tools }) },
    token,
  )
}

export function updatePlayground(
  token: string,
  id: string,
  patch: { title?: string; tools?: string[] | null },
) {
  return apiRequest<PlaygroundSession>(
    `/playground/${id}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    token,
  )
}

export function deletePlayground(token: string, id: string) {
  return apiRequest<void>(
    `/playground/${id}`,
    { method: 'DELETE' },
    token,
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(value: string | null) {
  if (!value) return 'No date'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

// ── Chat streaming ───────────────────────────────────────────────────────────

export type ModelSelect = {
  provider: string
  model_name: string
  reasoning_effort?: string | null
}

/** Build the path + body for a multi-model fanout chat. */
export function multiChatPayload(
  playgroundId: string,
  message: string,
  models: ModelSelect[],
  tools: string[],
) {
  return {
    path: `/playground/${playgroundId}/chat`,
    body: { message, models, tools },
  }
}

/** Build the path + body for a single-thread continue chat. */
export function continueChatPayload(
  playgroundId: string,
  threadId: string,
  message: string,
  tools: string[],
) {
  return {
    path: `/playground/${playgroundId}/chat/${threadId}`,
    body: { message, tools },
  }
}

export { API_BASE_URL }
