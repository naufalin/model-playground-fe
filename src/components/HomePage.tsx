import { useState } from 'react'
import type { FormEvent } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createModel, formatDate } from '@/lib/api'
import type { CreateModelPayload, DashboardData, User } from '@/lib/api'

type ModelFormState = {
  provider: 'openai' | 'openrouter'
  modelId: string
  name: string
  enabled: boolean
  supportsReasoning: boolean
  sortOrder: string
  config: string
}

const initialModelForm: ModelFormState = {
  provider: 'openrouter',
  modelId: '',
  name: '',
  enabled: true,
  supportsReasoning: false,
  sortOrder: '0',
  config: '',
}

export function HomePage({
  dashboardData,
  dashboardError,
  isDashboardLoading,
  onModelCreated,
  onLogout,
  onRefresh,
  token,
  user,
}: {
  dashboardData: DashboardData
  dashboardError: string | null
  isDashboardLoading: boolean
  onModelCreated: () => void
  onLogout: () => void
  onRefresh: () => void
  token: string
  user: User
}) {
  const displayName = user.display_name || user.email.split('@')[0]
  const [isAddingModel, setIsAddingModel] = useState(false)
  const [modelForm, setModelForm] = useState<ModelFormState>(initialModelForm)
  const [modelFormError, setModelFormError] = useState<string | null>(null)
  const [modelFormSuccess, setModelFormSuccess] = useState<string | null>(null)
  const [isCreatingModel, setIsCreatingModel] = useState(false)

  function updateModelForm<K extends keyof ModelFormState>(
    key: K,
    value: ModelFormState[K],
  ) {
    setModelForm((current) => ({ ...current, [key]: value }))
  }

  async function handleCreateModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setModelFormError(null)
    setModelFormSuccess(null)

    const modelId = modelForm.modelId.trim()
    const name = modelForm.name.trim()
    if (!modelId || !name) {
      setModelFormError('Model ID and display name are required.')
      return
    }

    const sortOrder = Number(modelForm.sortOrder)
    if (!Number.isInteger(sortOrder)) {
      setModelFormError('Sort order must be a whole number.')
      return
    }

    let config: CreateModelPayload['config'] = null
    if (modelForm.config.trim()) {
      try {
        const parsed = JSON.parse(modelForm.config) as unknown
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
          setModelFormError('Config must be a JSON object.')
          return
        }
        config = parsed as Record<string, unknown>
      } catch {
        setModelFormError('Config must be valid JSON.')
        return
      }
    }

    setIsCreatingModel(true)
    try {
      const created = await createModel(token, {
        provider: modelForm.provider,
        model_id: modelId,
        name,
        enabled: modelForm.enabled,
        supports_reasoning: modelForm.supportsReasoning,
        sort_order: sortOrder,
        config,
      })
      setModelForm(initialModelForm)
      setIsAddingModel(false)
      setModelFormSuccess(`${created.display_name} was added.`)
      onModelCreated()
    } catch (error) {
      setModelFormError(
        error instanceof Error ? error.message : 'Could not add model.',
      )
    } finally {
      setIsCreatingModel(false)
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
            <CardHeader className="items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {isDashboardLoading ? 'Loading registry' : 'Available models'}
                </p>
                <CardTitle>Model registry</CardTitle>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddingModel((current) => !current)
                  setModelFormError(null)
                  setModelFormSuccess(null)
                }}
              >
                {isAddingModel ? 'Close' : 'Add model'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {modelFormSuccess ? (
                <Alert>
                  <AlertDescription>{modelFormSuccess}</AlertDescription>
                </Alert>
              ) : null}

              {isAddingModel ? (
                <form
                  className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
                  onSubmit={handleCreateModel}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm font-medium text-slate-700">
                      <span>Provider</span>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        value={modelForm.provider}
                        onChange={(event) =>
                          updateModelForm(
                            'provider',
                            event.target.value as ModelFormState['provider'],
                          )
                        }
                      >
                        <option value="openrouter">OpenRouter</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm font-medium text-slate-700">
                      <span>Sort order</span>
                      <Input
                        inputMode="numeric"
                        value={modelForm.sortOrder}
                        onChange={(event) =>
                          updateModelForm('sortOrder', event.target.value)
                        }
                      />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium text-slate-700">
                      <span>Model ID</span>
                      <Input
                        placeholder="vendor/model"
                        value={modelForm.modelId}
                        onChange={(event) =>
                          updateModelForm('modelId', event.target.value)
                        }
                      />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium text-slate-700">
                      <span>Display name</span>
                      <Input
                        placeholder="Vendor Model"
                        value={modelForm.name}
                        onChange={(event) =>
                          updateModelForm('name', event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <label className="space-y-1.5 text-sm font-medium text-slate-700">
                    <span>Config JSON</span>
                    <textarea
                      className="min-h-24 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      placeholder='{"tier":"test"}'
                      value={modelForm.config}
                      onChange={(event) =>
                        updateModelForm('config', event.target.value)
                      }
                    />
                  </label>

                  <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-700">
                    <label className="flex items-center gap-2">
                      <input
                        checked={modelForm.enabled}
                        className="h-4 w-4"
                        type="checkbox"
                        onChange={(event) =>
                          updateModelForm('enabled', event.target.checked)
                        }
                      />
                      Enabled
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        checked={modelForm.supportsReasoning}
                        className="h-4 w-4"
                        type="checkbox"
                        onChange={(event) =>
                          updateModelForm(
                            'supportsReasoning',
                            event.target.checked,
                          )
                        }
                      />
                      Supports reasoning
                    </label>
                  </div>

                  {modelFormError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{modelFormError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isCreatingModel}>
                      {isCreatingModel ? 'Adding model...' : 'Add model'}
                    </Button>
                  </div>
                </form>
              ) : null}

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
