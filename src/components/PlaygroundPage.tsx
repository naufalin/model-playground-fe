import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MessageSquarePlus, Pencil, Plus, Square, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ChatInput } from '@/components/ChatInput'
import { ModelSelector } from '@/components/ModelSelector'
import { ThreadPanel } from '@/components/ThreadPanel'
import { useAuth } from '@/lib/use-auth'
import { useChatStream } from '@/lib/use-chat-stream'
import {
  createPlayground,
  deletePlayground,
  getModels,
  getPlaygroundDetail,
  updatePlayground,
} from '@/lib/api'
import type { Model, ModelSelect, PlaygroundDetail } from '@/lib/api'

export function PlaygroundPage() {
  const { id } = useParams<{ id: string }>()
  const { token, user, onLogout } = useAuth()
  const navigate = useNavigate()

  // Data
  const [detail, setDetail] = useState<PlaygroundDetail | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Chat — welcome state uses multi-chat, per-thread uses continue
  const [selectedModels, setSelectedModels] = useState<ModelSelect[]>([])
  const [message, setMessage] = useState('')
  const { streamState, sendMultiChat, sendContinueChat, abort, reset } =
    useChatStream(token, id ?? '')
  const prevChatStatus = useRef(streamState.chatStatus)

  // Rename
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Delete
  const [isDeleting, setIsDeleting] = useState(false)

  // New playground
  const [isCreating, setIsCreating] = useState(false)

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadDetail = useCallback(async () => {
    if (!id) return
    const d = await getPlaygroundDetail(token, id)
    setDetail(d)
  }, [id, token])

  useEffect(() => {
    if (!id) return

    let cancelled = false

    Promise.all([getPlaygroundDetail(token, id), getModels(token)])
      .then(([d, m]) => {
        if (!cancelled) {
          setDetail(d)
          setModels(m.models)
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

  // Refresh detail when stream finishes
  useEffect(() => {
    if (
      prevChatStatus.current === 'streaming' &&
      streamState.chatStatus === 'done'
    ) {
      loadDetail()
    }
    prevChatStatus.current = streamState.chatStatus
  }, [streamState.chatStatus, loadDetail])

  // Focus rename input
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** First prompt — sends to all selected models via fanout. */
  async function handleSend() {
    if (!message.trim() || selectedModels.length === 0) return

    reset()
    await sendMultiChat(message.trim(), selectedModels)
    setMessage('')
  }

  /** Continue a single thread independently. */
  function handleContinue(threadId: string, msg: string) {
    sendContinueChat(threadId, msg)
  }

  function handleStop() {
    abort()
  }

  function startRename() {
    if (!detail) return
    setEditTitle(detail.title)
    setIsEditing(true)
  }

  async function handleRename(event: FormEvent) {
    event.preventDefault()
    if (!detail || !id || !editTitle.trim()) return

    const newTitle = editTitle.trim()
    if (newTitle === detail.title) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      const updated = await updatePlayground(token, id, newTitle)
      setDetail((prev) => (prev ? { ...prev, title: updated.title } : prev))
      setIsEditing(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not rename.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return

    setIsDeleting(true)
    try {
      await deletePlayground(token, id)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
      setIsDeleting(false)
    }
  }

  async function handleNewPlayground() {
    setIsCreating(true)
    try {
      const now = new Date()
      const title = `Playground ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      const result = await createPlayground(token, title)
      navigate(`/playground/${result.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create playground.')
    } finally {
      setIsCreating(false)
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const displayName = user.display_name || user.email.split('@')[0]
  const isStreaming = streamState.chatStatus === 'streaming'
  const hasThreads = detail ? detail.threads.length > 0 : false
  const hasStreamThreads = Object.keys(streamState.threads).length > 0

  // Build a map of threadId → historical messages for quick lookup
  const threadMessages = new Map(
    detail?.threads.map((t) => [t.id, t.messages]) ?? [],
  )

  // Merge stream thread IDs with historical thread IDs for display
  const allThreadIds = [
    ...new Set([
      ...(detail?.threads.map((t) => t.id) ?? []),
      ...Object.keys(streamState.threads),
    ]),
  ]

  // Thread metadata (from detail) by ID
  const threadMeta = new Map(
    detail?.threads.map((t) => [t.id, t]) ?? [],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="flex h-screen flex-col bg-[#f7f3ea] text-slate-950">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white"
              onClick={() => navigate('/')}
            >
              MP
            </button>
            <div className="min-w-0">
              {isEditing ? (
                <form onSubmit={handleRename} className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleRename}
                    disabled={isSaving}
                    className="h-7 w-64 text-sm font-semibold"
                    maxLength={255}
                  />
                </form>
              ) : (
                <button
                  className="group flex items-center gap-2 text-left"
                  onDoubleClick={startRename}
                  title="Double-click to rename"
                >
                  <p className="truncate font-semibold">
                    {isLoading ? 'Loading...' : detail?.title ?? 'Playground'}
                  </p>
                  {!isLoading && detail && (
                    <Pencil className="hidden size-3 text-slate-400 group-hover:inline" />
                  )}
                </button>
              )}
              <p className="text-xs text-slate-500">{id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isLoading && detail && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleNewPlayground}
                  disabled={isCreating}
                  title="New playground"
                >
                  <Plus className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={startRename}
                  title="Rename"
                >
                  <Pencil className="size-4" />
                </Button>
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" title="Delete" />
                    }
                  >
                    <Trash2 className="size-4 text-red-500" />
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete playground?</DialogTitle>
                      <DialogDescription>
                        This will permanently delete{' '}
                        <strong>{detail.title}</strong> and all its threads and
                        messages. This cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>
                        Cancel
                      </DialogClose>
                      <Button
                        variant="destructive"
                        disabled={isDeleting}
                        onClick={handleDelete}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <div className="mx-2 hidden h-6 w-px bg-slate-200 sm:block" />
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

      {/* Error banner */}
      {error && (
        <Alert variant="destructive" className="mx-auto mt-4 max-w-7xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-500">Loading playground...</p>
          </div>
        ) : !hasThreads && !hasStreamThreads ? (
          /* ── Welcome state: no threads yet ── */
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="w-full max-w-xl space-y-6 text-center">
              <MessageSquarePlus className="mx-auto size-12 text-slate-300" />
              <div>
                <h2 className="text-xl font-semibold">Start comparing models</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Select two or more models below, type a prompt, and see their
                  responses side by side.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-left">
                <ModelSelector
                  models={models}
                  selected={selectedModels}
                  onChange={setSelectedModels}
                  disabled={isStreaming}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <ChatInput
                    value={message}
                    onChange={setMessage}
                    onSubmit={handleSend}
                    disabled={isStreaming || selectedModels.length === 0}
                    placeholder={
                      selectedModels.length === 0
                        ? 'Select models first...'
                        : 'Type a prompt to compare...'
                    }
                  />
                </div>
                {isStreaming && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleStop}
                    className="shrink-0"
                  >
                    <Square className="mr-1 size-3" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Chat view: per-thread panels with individual inputs ── */
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
            <div
              className="grid h-full gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.min(allThreadIds.length, 3)}, minmax(280px, 1fr))`,
              }}
            >
              {allThreadIds.map((threadId) => {
                const meta = threadMeta.get(threadId)
                const historical = threadMessages.get(threadId) ?? []
                const stream = streamState.threads[threadId]

                return (
                  <ThreadPanel
                    key={threadId}
                    displayName={meta?.display_name ?? threadId}
                    provider={meta?.provider ?? 'unknown'}
                    modelName={meta?.model_name ?? threadId}
                    messages={historical}
                    streamState={stream}
                    onContinue={(msg) => handleContinue(threadId, msg)}
                    disabled={stream?.status === 'streaming'}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
