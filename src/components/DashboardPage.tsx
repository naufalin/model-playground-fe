import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BotMessageSquare,
  ChevronDown,
  Cpu,
  FlaskConical,
  Layers,
  Zap,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
import type { DashboardData, Model } from '@/lib/api'
import { cn } from '@/lib/utils'

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
  const [prompt, setPrompt] = useState('')
  const [selectedQuickModels, setSelectedQuickModels] = useState<Model[]>([])
  const [showAllModels, setShowAllModels] = useState(false)
  const [showSessionPicker, setShowSessionPicker] = useState(false)
  const promptRef = useRef<HTMLInputElement>(null)
  const sessionPickerRef = useRef<HTMLDivElement>(null)

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

  // Close session picker on outside click
  useEffect(() => {
    if (!showSessionPicker) return
    function handleClick(e: MouseEvent) {
      if (sessionPickerRef.current && !sessionPickerRef.current.contains(e.target as Node)) {
        setShowSessionPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSessionPicker])

  async function handleNewPlayground(initialPrompt?: string) {
    setIsCreating(true)
    try {
      const created = await createPlayground(token)
      navigate(`/playground/${created.id}`, {
        state: initialPrompt ? { initialPrompt } : undefined,
      })
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not create playground.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  function handlePromptSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed) return
    setPrompt('')
    handleNewPlayground(trimmed)
  }

  function toggleQuickModel(model: Model) {
    setSelectedQuickModels((prev) => {
      const exists = prev.some((m) => m.id === model.id)
      if (exists) return prev.filter((m) => m.id !== model.id)
      return [...prev, model]
    })
  }

  // Derive quick-start chips: show first 3 or all
  const quickModelChips = showAllModels ? data.models : data.models.slice(0, 3)
  const remainingModelCount = Math.max(0, data.models.length - 3)

  return (
    <main className="glass-mesh-bg min-h-screen bg-[#080B14] text-white">
      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080B14]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-white text-xs font-black text-[#080B14] shadow-sm">
              MP
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">Model Playground</p>
              <p className="text-[11px] text-white/50">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white/70">{displayName}</p>
              <p className="text-[11px] text-white/40">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="rounded-full border border-white/12 bg-white/8 px-3.5 text-xs font-medium text-white/60 hover:bg-white/12 hover:text-white"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        {/* ── Hero: actions + stats ──────────────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          {/* Left — actions */}
          <div className="rounded-3xl border border-white/10 p-7 text-white" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5EF2C1]">
              Workspace ready
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Start a playground, compare responses, and keep every experiment organized.
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                size="default"
                className="bg-white/90 text-[#080B14] hover:bg-white rounded-xl font-semibold"
                disabled={isCreating}
                onClick={() => handleNewPlayground()}
              >
                {isCreating ? 'Creating...' : 'New playground'}
              </Button>

              {/* Recent session picker */}
              <div className="relative" ref={sessionPickerRef}>
                <Button
                  variant="ghost"
                  size="default"
                  className="border border-white/15 text-white hover:bg-white/10 hover:text-white rounded-xl"
                  onClick={() => setShowSessionPicker((v) => !v)}
                  disabled={data.sessions.length === 0}
                >
                  Select recent session
                  <ChevronDown className="ml-1 size-3.5" />
                </Button>
                {showSessionPicker && data.sessions.length > 0 && (
                  <div className="glass-card absolute left-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-xl">
                    {data.sessions.slice(0, 8).map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/8"
                        onClick={() => {
                          setShowSessionPicker(false)
                          navigate(`/playground/${session.id}`)
                        }}
                      >
                        <span className="truncate font-medium">
                          {session.title}
                        </span>
                        <ArrowRight className="ml-2 size-3.5 shrink-0 text-white/30" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right — inline stats */}
          <div className="flex flex-col justify-center gap-4">
            <StatRow
              icon={<Layers className="size-4" />}
              label="Models"
              value={data.models.length}
            />
            <StatRow
              icon={<FlaskConical className="size-4" />}
              label="Sessions"
              value={data.totalSessions}
            />
            <StatRow
              icon={<Cpu className="size-4" />}
              label="Local lab"
              value={null}
              valueText="Ready"
              highlight
            />
          </div>
        </section>

        {/* ── Quick-start prompt ─────────────────────────────────────────── */}
        <section className="mt-6">
          <form
            onSubmit={handlePromptSubmit}
            className="glass-card rounded-3xl p-5"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-white/70">
                <Zap className="size-4" />
              </div>
              <input
                ref={promptRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask something to compare..."
                disabled={isCreating}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isCreating || !prompt.trim()}
                className="shrink-0 rounded-full bg-white/90 px-4 text-[#080B14] font-semibold shadow-[0_6px_20px_rgba(0,0,0,0.2)] hover:bg-white"
              >
                Run comparison
                <ArrowRight className="ml-1 size-3.5" />
              </Button>
            </div>

            {/* Model chips */}
            {data.models.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
                {quickModelChips.map((model) => {
                  const selected = selectedQuickModels.some((m) => m.id === model.id)
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => toggleQuickModel(model)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                        selected
                          ? 'border-[#B8F3DC] bg-[#E8FFF6] text-[#047857]'
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10',
                      )}
                    >
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          selected ? 'bg-[#047857]' : 'bg-white/25',
                        )}
                      />
                      {model.display_name}
                    </button>
                  )
                })}
                {remainingModelCount > 0 && !showAllModels && (
                  <button
                    type="button"
                    onClick={() => setShowAllModels(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-1 text-xs font-medium text-white/40 transition-colors hover:border-white/25 hover:text-white/60"
                  >
                    +{remainingModelCount} more
                  </button>
                )}
                {showAllModels && remainingModelCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllModels(false)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white/40 transition-colors hover:text-white/60"
                  >
                    Show less
                  </button>
                )}
              </div>
            )}
          </form>
        </section>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error ? (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* ── Model registry + recent work ───────────────────────────────── */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="glass-card rounded-3xl">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                {isLoading ? 'Loading registry' : 'Available models'}
              </p>
              <CardTitle className="text-white">Model registry</CardTitle>
            </CardHeader>
            <CardContent>
              {data.models.length > 0 ? (
                <div className="space-y-2">
                  {data.models.map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      onClick={() => handleNewPlayground()}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  isLoading={isLoading}
                  loadingText="Fetching models..."
                  text="No active models found"
                  description="Models are synced from the agent runtime registry."
                  icon={Cpu}
                />
              )}
            </CardContent>
          </Card>

          <Card className="glass-card rounded-3xl">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                {isLoading ? 'Loading history' : 'Recent work'}
              </p>
              <CardTitle className="text-white">Playground sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {data.sessions.length > 0 ? (
                <div className="space-y-2">
                  {data.sessions.map((session) => (
                    <button
                      className="glass-surface glass-surface-hover group flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
                      key={session.id}
                      onClick={() => navigate(`/playground/${session.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-white">{session.title}</p>
                        <p className="mt-0.5 text-xs text-white/40">
                          Created {formatDate(session.created_at)}
                        </p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[11px] text-white/25 transition-colors group-hover:text-white/40">
                          {session.id}
                        </span>
                        <ArrowUpRight className="size-4 text-white/20 transition-all group-hover:text-[#5EF2C1] group-hover:-translate-y-px group-hover:translate-x-px" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  isLoading={isLoading}
                  loadingText="Fetching sessions..."
                  text="No playground sessions yet"
                  description="Create your first playground to start comparing models."
                  icon={BotMessageSquare}
                  action={
                    <Button
                      size="sm"
                      className="mt-1"
                      disabled={isCreating}
                      onClick={() => handleNewPlayground()}
                    >
                      {isCreating ? 'Creating...' : 'New playground'}
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatRow({
  icon,
  label,
  value,
  valueText,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: number | null
  valueText?: string
  highlight?: boolean
}) {
  return (
    <div className="glass-surface flex items-center gap-3 rounded-2xl px-4 py-3">
      <div className="grid size-9 place-items-center rounded-[14px] bg-white/8 text-white/70">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white/50">{label}</p>
        {highlight && valueText ? (
          <span className="mt-0.5 inline-flex items-center rounded-full border border-[#B8F3DC] bg-[#E8FFF6] px-2.5 py-0.5 text-sm font-semibold text-[#047857]">
            {valueText}
          </span>
        ) : (
          <p className="text-lg font-semibold tracking-tight text-white">
            {valueText ?? (value != null ? String(value) : '—')}
          </p>
        )}
      </div>
    </div>
  )
}

function ModelCard({
  model,
  onClick,
}: {
  model: Model
  onClick: () => void
}) {
  const caps = getModelCapabilities(model)

  return (
    <button
      type="button"
      className="glass-surface glass-surface-hover group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
      onClick={onClick}
    >
      {/* Provider initial */}
      <div
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white',
          providerColor(model.provider),
        )}
      >
        {providerInitial(model.provider)}
      </div>

      {/* Name + slug */}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-white">{model.display_name}</p>
        <p className="mt-0.5 font-mono text-xs text-white/40 truncate">
          {model.provider}/{model.model_name}
        </p>
      </div>

      {/* Capability chips */}
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {caps.map((cap) => (
          <span
            key={cap.label}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              cap.className,
            )}
          >
            {cap.icon && <cap.icon className="size-2.5" />}
            {cap.label}
          </span>
        ))}
      </div>
    </button>
  )
}

type Capability = {
  label: string
  className: string
  icon?: React.ComponentType<{ className?: string }>
}

function getModelCapabilities(model: Model): Capability[] {
  const caps: Capability[] = []

  // Provider chip
  if (model.provider === 'openrouter') {
    caps.push({
      label: 'OpenRouter',
      className: 'bg-white/8 text-white/60 ring-1 ring-white/10',
    })
  } else if (model.provider === 'openai') {
    caps.push({
      label: 'OpenAI',
      className: 'bg-white/8 text-white/60 ring-1 ring-white/10',
    })
  }

  // Reasoning
  if (model.supports_reasoning) {
    caps.push({
      label: 'Reasoning',
      className: 'bg-[#E8FFF6] text-[#047857] ring-1 ring-[#B8F3DC]',
    })
  }

  // Speed tier from model name heuristics
  const name = model.model_name.toLowerCase()
  if (name.includes('nano')) {
    caps.push({
      label: 'Nano',
      className: 'bg-white/8 text-white/60 ring-1 ring-white/10',
      icon: Zap,
    })
  } else if (name.includes('mini')) {
    caps.push({
      label: 'Fast',
      className: 'bg-white/8 text-white/60 ring-1 ring-white/10',
      icon: Zap,
    })
  }

  return caps
}

function providerInitial(provider: string): string {
  if (provider === 'openrouter') return 'OR'
  if (provider === 'openai') return 'OA'
  return provider.slice(0, 2).toUpperCase()
}

function providerColor(provider: string): string {
  if (provider === 'openrouter') return 'bg-[#080B14]'
  if (provider === 'openai') return 'bg-[#334155]'
  if (provider.includes('qwen') || provider.includes('alibaba')) return 'bg-[#080B14]'
  return 'bg-[#334155]'
}

// ── Shared ───────────────────────────────────────────────────────────────────

function EmptyState({
  isLoading,
  loadingText,
  text,
  description,
  icon: Icon,
  action,
}: {
  isLoading: boolean
  loadingText: string
  text: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/3 px-5 text-center">
      {isLoading ? (
        <p className="text-sm font-medium text-white/50">{loadingText}</p>
      ) : (
        <>
          {Icon && <Icon className="size-8 text-white/20" />}
          <div>
            <p className="text-sm font-medium text-white/50">{text}</p>
            {description && (
              <p className="mt-1 text-xs text-white/30">{description}</p>
            )}
          </div>
          {action}
        </>
      )}
    </div>
  )
}
