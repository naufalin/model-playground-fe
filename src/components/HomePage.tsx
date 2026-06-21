import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDate } from '@/lib/api'
import type { DashboardData, User } from '@/lib/api'

export function HomePage({
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
              Your model registry and recent playground sessions are synced from
              the FastAPI service. Start a new comparison when the chat workspace
              is ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
                New playground
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={onRefresh}
              >
                Refresh overview
              </Button>
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
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{dashboardError}</AlertDescription>
          </Alert>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {isDashboardLoading ? 'Loading registry' : 'Available models'}
              </p>
              <CardTitle>Model registry</CardTitle>
            </CardHeader>
            <CardContent>
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
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                        Active
                      </Badge>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {isDashboardLoading ? 'Loading history' : 'Recent work'}
              </p>
              <CardTitle>Playground sessions</CardTitle>
            </CardHeader>
            <CardContent>
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
                      <Badge variant="secondary">
                        {session.id}
                      </Badge>
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
