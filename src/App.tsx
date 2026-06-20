import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8008'
).replace(/\/$/, '')

const TOKEN_STORAGE_KEY = 'model_playground_token'

type AuthMode = 'login' | 'signup'
type AppStatus = 'checking' | 'authenticated' | 'unauthenticated'

type TokenResponse = {
  access_token: string
  token_type: string
}

type User = {
  id: string
  email: string
  display_name: string | null
}

type Model = {
  id: string
  provider: string
  model_name: string
  display_name: string
}

type PlaygroundSession = {
  id: string
  title: string
  created_at: string | null
}

type ModelsResponse = {
  models: Model[]
}

type PlaygroundListResponse = {
  sessions: PlaygroundSession[]
  total: number
}

type AuthForm = {
  email: string
  password: string
  displayName: string
}

type DashboardData = {
  models: Model[]
  sessions: PlaygroundSession[]
  totalSessions: number
}

class ApiError extends Error {
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

function login(email: string, password: string) {
  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

function signup(email: string, password: string, displayName: string) {
  return apiRequest<User>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      display_name: displayName.trim() || null,
    }),
  })
}

function getCurrentUser(token: string) {
  return apiRequest<User>('/auth/me', {}, token)
}

function getModels(token: string) {
  return apiRequest<ModelsResponse>('/models', {}, token)
}

function getPlaygroundSessions(token: string) {
  return apiRequest<PlaygroundListResponse>(
    '/playground?limit=20&offset=0',
    {},
    token,
  )
}

function formatDate(value: string | null) {
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

function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  )
  const [status, setStatus] = useState<AppStatus>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY) ? 'checking' : 'unauthenticated',
  )
  const [user, setUser] = useState<User | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    models: [],
    sessions: [],
    totalSessions: 0,
  })
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [isDashboardLoading, setIsDashboardLoading] = useState(false)

  const loadDashboard = useCallback((activeToken: string) => {
    setIsDashboardLoading(true)
    setDashboardError(null)

    Promise.all([getModels(activeToken), getPlaygroundSessions(activeToken)])
      .then(([modelsResponse, sessionsResponse]) => {
        setDashboardData({
          models: modelsResponse.models,
          sessions: sessionsResponse.sessions,
          totalSessions: sessionsResponse.total,
        })
      })
      .catch((error: unknown) => {
        setDashboardError(
          error instanceof Error
            ? error.message
            : 'Could not load dashboard data.',
        )
      })
      .finally(() => {
        setIsDashboardLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!token || status !== 'checking') {
      return
    }

    getCurrentUser(token)
      .then((profile) => {
        setUser(profile)
        setStatus('authenticated')
        loadDashboard(token)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
        setStatus('unauthenticated')
      })
  }, [loadDashboard, status, token])

  function completeAuth(nextToken: string, profile: User) {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    setToken(nextToken)
    setUser(profile)
    setStatus('authenticated')
    loadDashboard(nextToken)
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
    setDashboardData({ models: [], sessions: [], totalSessions: 0 })
    setDashboardError(null)
    setStatus('unauthenticated')
  }

  if (status === 'checking') {
    return <LoadingScreen />
  }

  if (status === 'authenticated' && user && token) {
    return (
      <HomePage
        dashboardData={dashboardData}
        dashboardError={dashboardError}
        isDashboardLoading={isDashboardLoading}
        onRefresh={() => loadDashboard(token)}
        onLogout={handleLogout}
        token={token}
        user={user}
      />
    )
  }

  return <AuthPage onAuthenticated={completeAuth} />
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f3ea] px-6 text-slate-950">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
        <span className="text-sm font-medium">Restoring your workspace</span>
      </div>
    </main>
  )
}

function AuthPage({
  onAuthenticated,
}: {
  onAuthenticated: (token: string, user: User) => void
}) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [form, setForm] = useState<AuthForm>({
    email: '',
    password: '',
    displayName: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validationError = useMemo(() => {
    if (!form.email.trim()) {
      return 'Email is required.'
    }

    if (!form.email.includes('@')) {
      return 'Use a valid email address.'
    }

    if (!form.password) {
      return 'Password is required.'
    }

    if (mode === 'signup' && form.password.length < 8) {
      return 'Password must be at least 8 characters.'
    }

    return null
  }, [form.email, form.password, mode])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'signup') {
        await signup(form.email.trim(), form.password, form.displayName)
      }

      const tokenResponse = await login(form.email.trim(), form.password)
      const profile = await getCurrentUser(tokenResponse.access_token)
      onAuthenticated(tokenResponse.access_token, profile)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to authenticate right now.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError(null)
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
        <section className="relative flex min-h-[44vh] flex-col justify-between overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-10 lg:min-h-screen">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.34),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.85),rgba(15,23,42,0.98))]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(to_top,rgba(247,243,234,0.16),transparent)]" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-sm font-black text-slate-950">
                MP
              </div>
              <div>
                <p className="text-sm font-semibold">Model Playground</p>
                <p className="text-xs text-slate-300">Compare LLMs with focus</p>
              </div>
            </div>
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-slate-200">
              Local lab
            </span>
          </div>

          <div className="relative z-10 max-w-2xl py-16 lg:py-0">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Side-by-side model testing
            </p>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] text-white sm:text-6xl">
              A calmer desk for sharper model decisions.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
              Sign in to review available models, reopen recent playgrounds, and
              keep experiments organized before the chat workspace arrives.
            </p>
          </div>

          <div className="relative z-10 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            {['FastAPI auth', 'Model registry', 'Session history'].map((item) => (
              <div
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-sm font-medium text-slate-500">
                Welcome back
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
              </h2>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-200 p-1">
              <button
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  mode === 'login'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
                onClick={() => switchMode('login')}
                type="button"
              >
                Login
              </button>
              <button
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  mode === 'signup'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
                onClick={() => switchMode('signup')}
                type="button"
              >
                Signup
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === 'signup' ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Display name
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Ada Lovelace"
                    type="text"
                    value={form.displayName}
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  autoComplete="email"
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="you@example.com"
                  type="email"
                  value={form.email}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Password
                </span>
                <input
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder={
                    mode === 'signup' ? 'At least 8 characters' : 'Your password'
                  }
                  type="password"
                  value={form.password}
                />
              </label>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                className="flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? 'Working...'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              API: <span className="font-medium text-slate-700">{API_BASE_URL}</span>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

function HomePage({
  dashboardData,
  dashboardError,
  isDashboardLoading,
  onLogout,
  onRefresh,
  token,
  user,
}: {
  dashboardData: DashboardData
  dashboardError: string | null
  isDashboardLoading: boolean
  onLogout: () => void
  onRefresh: () => void
  token: string
  user: User
}) {
  const displayName = user.display_name || user.email.split('@')[0]

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white">
              MP
            </div>
            <div>
              <p className="font-semibold">Model Playground</p>
              <p className="text-xs text-slate-500">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <button
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              onClick={onLogout}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-lg bg-slate-950 p-8 text-white shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">
              Workspace ready
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Welcome back, {displayName}.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Your model registry and recent playground sessions are synced from
              the FastAPI service. Start a new comparison when the chat workspace
              is ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                type="button"
              >
                New playground
              </button>
              <button
                className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                onClick={onRefresh}
                type="button"
              >
                Refresh overview
              </button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
            <MetricCard
              label="Available models"
              value={String(dashboardData.models.length)}
            />
            <MetricCard
              label="Recent sessions"
              value={String(dashboardData.totalSessions)}
            />
            <MetricCard
              label="Token"
              value={`${token.slice(0, 8)}...`}
            />
          </div>
        </section>

        {dashboardError ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {dashboardError}
          </div>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel
            eyebrow={
              isDashboardLoading ? 'Loading registry' : 'Available models'
            }
            title="Model registry"
          >
            {dashboardData.models.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.models.map((model) => (
                  <div
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                    key={model.id}
                  >
                    <div>
                      <p className="font-semibold">{model.display_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {model.provider} / {model.model_name}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                isLoading={isDashboardLoading}
                loadingText="Fetching models..."
                text="No active models found yet."
              />
            )}
          </Panel>

          <Panel
            eyebrow={isDashboardLoading ? 'Loading history' : 'Recent work'}
            title="Playground sessions"
          >
            {dashboardData.sessions.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.sessions.map((session) => (
                  <div
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                    key={session.id}
                  >
                    <div>
                      <p className="font-semibold">{session.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Created {formatDate(session.created_at)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {session.id}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                isLoading={isDashboardLoading}
                loadingText="Fetching sessions..."
                text="No playground sessions yet."
              />
            )}
          </Panel>
        </section>
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function Panel({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white/70 p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function EmptyState({
  isLoading,
  loadingText,
  text,
}: {
  isLoading: boolean
  loadingText: string
  text: string
}) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-5 text-center">
      <p className="text-sm font-medium text-slate-500">
        {isLoading ? loadingText : text}
      </p>
    </div>
  )
}

export default App
