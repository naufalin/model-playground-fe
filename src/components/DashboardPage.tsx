import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/lib/use-auth'
import {
  createPlayground,
  formatDate,
  getModels,
  getPlaygroundSessions,
} from '@/lib/api'
import type { DashboardData } from '@/lib/api'

export function DashboardPage() {
  const { token, user, onLogout } = useAuth()
  const navigate = useNavigate()
  const displayName = user.display_name || user.email.split('@')[0]

  const [data, setData] = useState<DashboardData>({
    models: [],
    sessions: [],
    totalSessions: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      const [modelsResponse, sessionsResponse] = await Promise.all([
        getModels(token),
        getPlaygroundSessions(token),
      ])
      setData({
        models: modelsResponse.models,
        sessions: sessionsResponse.sessions,
        totalSessions: sessionsResponse.total,
      })
      setError(null)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load dashboard data.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState only in callbacks
    fetchDashboard()
  }, [fetchDashboard])

  /** Refresh on button click — resets loading + error first. */
  function loadDashboard() {
    setIsLoading(true)
    setError(null)
    fetchDashboard()
  }

  async function handleNewPlayground() {
    setIsCreating(true)
    try {
      const created = await createPlayground(token)
      navigate(`/playground/${created.id}`)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not create playground.',
      )
    } finally {
      setIsCreating(false)
    }
  }

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
            <Button variant="outline" onClick={onLogout}>
              Logout
            </Button>
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
              Select models, send a prompt, and compare responses side by side.
              Create a new playground or pick up where you left off.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="bg-white text-slate-950 hover:bg-slate-100"
                disabled={isCreating}
                onClick={handleNewPlayground}
              >
                {isCreating ? 'Creating...' : 'New playground'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={loadDashboard}
              >
                Refresh overview
              </Button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
            <MetricCard
              label="Available models"
              value={String(data.models.length)}
            />
            <MetricCard
              label="Recent sessions"
              value={String(data.totalSessions)}
            />
            <MetricCard
              label="Token"
              value={`${token.slice(0, 8)}...`}
            />
          </div>
        </section>

        {error ? (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {isLoading ? 'Loading registry' : 'Available models'}
              </p>
              <CardTitle>Model registry</CardTitle>
            </CardHeader>
            <CardContent>
              {data.models.length > 0 ? (
                <div className="space-y-3">
                  {data.models.map((model) => (
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
                      <div className="flex items-center gap-2">
                        {model.supports_reasoning && (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                            Reasoning
                          </Badge>
                        )}
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                          Active
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  isLoading={isLoading}
                  loadingText="Fetching models..."
                  text="No active models found yet."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {isLoading ? 'Loading history' : 'Recent work'}
              </p>
              <CardTitle>Playground sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {data.sessions.length > 0 ? (
                <div className="space-y-3">
                  {data.sessions.map((session) => (
                    <button
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                      key={session.id}
                      onClick={() => navigate(`/playground/${session.id}`)}
                    >
                      <div>
                        <p className="font-semibold">{session.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Created {formatDate(session.created_at)}
                        </p>
                      </div>
                      <Badge variant="secondary">{session.id}</Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  isLoading={isLoading}
                  loadingText="Fetching sessions..."
                  text="No playground sessions yet."
                />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
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
