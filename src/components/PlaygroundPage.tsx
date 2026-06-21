import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/use-auth'
import { getPlaygroundDetail } from '@/lib/api'
import type { PlaygroundDetail } from '@/lib/api'

export function PlaygroundPage() {
  const { id } = useParams<{ id: string }>()
  const { token, user, onLogout } = useAuth()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<PlaygroundDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    getPlaygroundDetail(token, id)
      .then((d) => {
        if (!cancelled) {
          setDetail(d)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load playground.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, token])

  const displayName = user.display_name || user.email.split('@')[0]

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white"
              onClick={() => navigate('/')}
            >
              MP
            </button>
            <div>
              <p className="font-semibold">
                {isLoading ? 'Loading...' : detail?.title ?? 'Playground'}
              </p>
              <p className="text-xs text-slate-500">{id}</p>
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
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-sm text-slate-500">Loading playground...</p>
          </div>
        ) : detail ? (
          <div>
            {/* Thread overview */}
            <section>
              <h2 className="text-lg font-semibold">
                Threads ({detail.threads.length})
              </h2>
              {detail.threads.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No threads yet. Select models and send a message to start
                  comparing.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {detail.threads.map((thread) => (
                    <div
                      key={thread.id}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{thread.display_name}</p>
                          <p className="text-sm text-slate-500">
                            {thread.provider} / {thread.model_name}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {thread.messages.length} messages
                        </Badge>
                      </div>
                      {thread.messages.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                          {thread.messages.slice(-3).map((msg) => (
                            <div
                              key={msg.id}
                              className="text-sm"
                            >
                              <span className="mr-2 font-medium capitalize text-slate-600">
                                {msg.role}:
                              </span>
                              <span className="text-slate-800">
                                {msg.content.length > 200
                                  ? `${msg.content.slice(0, 200)}...`
                                  : msg.content}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Chat workspace placeholder */}
            <section className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-sm font-medium text-slate-500">
                Chat workspace coming in Phase 3.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Model selection, streaming responses, and side-by-side
                comparison.
              </p>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  )
}
