const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8008'
).replace(/\/$/, '')

export const TOKEN_STORAGE_KEY = 'model_playground_token'

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
}

export type PlaygroundSession = {
  id: string
  title: string
  created_at: string | null
}

export type ModelsResponse = {
  models: Model[]
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

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

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

export function getModels(token: string) {
  return apiRequest<ModelsResponse>('/models', {}, token)
}

export function getPlaygroundSessions(token: string) {
  return apiRequest<PlaygroundListResponse>(
    '/playground?limit=20&offset=0',
    {},
    token,
  )
}

export function formatDate(value: string | null) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export { API_BASE_URL }
