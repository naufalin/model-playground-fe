import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Eye, EyeOff, MessageSquarePlus, Pencil, Plus, Square, Trash2 } from 'lucide-react'

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
import { ToolSelector } from '@/components/ToolSelector'
import { VisualizationIframe } from '@/components/VisualizationIframe'
import { useAuth } from '@/lib/use-auth'
import { useChatStream } from '@/lib/use-chat-stream'
import {
  createPlayground,
  deletePlayground,
  getModels,
  getPlaygroundDetail,
  getTools,
  updatePlayground,
} from '@/lib/api'
import type { Message, Model, ModelSelect, PlaygroundDetail, Tool } from '@/lib/api'
import type { ToolEvent } from '@/lib/use-chat-stream'

type SelectedVisualization = {
  html: string
  title?: string
  threadId: string
  source: 'live' | 'history'
}

export function PlaygroundPage() {
  const { id } = useParams<{ id: string }>()
  const { token, user, onLogout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Data
  const [detail, setDetail] = useState<PlaygroundDetail | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Chat — welcome state uses multi-chat, per-thread uses continue
  const [selectedModels, setSelectedModels] = useState<ModelSelect[]>([])
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [isSavingTools, setIsSavingTools] = useState(false)
  const [message, setMessage] = useState('')
  const [sentPrompt, setSentPrompt] = useState<string | null>(null)
  const [isVisualizationVisible, setIsVisualizationVisible] = useState(true)
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

    Promise.all([getPlaygroundDetail(token, id), getModels(token), getTools(token)])
      .then(([d, m, t]) => {
        if (!cancelled) {
          setDetail(d)
          setModels(m.models)
          setTools(t.tools)
          setSelectedTools(d.tools ?? t.tools.map((tool) => tool.name))
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

  // Pre-fill message from dashboard quick-start prompt
  const initialPrompt = (location.state as { initialPrompt?: string } | null)
    ?.initialPrompt
  const promptPrefilledRef = useRef(false)

  useEffect(() => {
    if (!initialPrompt || promptPrefilledRef.current || isLoading) return
    promptPrefilledRef.current = true
    setMessage(initialPrompt)
    window.history.replaceState({}, '', location.pathname)
  }, [initialPrompt, isLoading, location.pathname])

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** First prompt — sends to all selected models via fanout. */
  async function handleSend() {
    if (!message.trim() || selectedModels.length === 0) return

    setSentPrompt(message.trim())
    reset()
    await sendMultiChat(message.trim(), selectedModels, selectedTools)
    setMessage('')
  }

  /** Continue a single thread independently. */
  function handleContinue(threadId: string, msg: string) {
    sendContinueChat(threadId, msg, selectedTools)
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
      const updated = await updatePlayground(token, id, { title: newTitle })
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
      const result = await createPlayground(token, title, selectedTools)
      navigate(`/playground/${result.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create playground.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleToolsChange(nextTools: string[]) {
    setSelectedTools(nextTools)
    if (!id || !detail) return

    setIsSavingTools(true)
    try {
      const updated = await updatePlayground(token, id, { tools: nextTools })
      setDetail((prev) => (prev ? { ...prev, tools: updated.tools } : prev))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update tools.')
    } finally {
      setIsSavingTools(false)
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const displayName = user.display_name || user.email.split('@')[0]
  const isStreaming = streamState.chatStatus === 'streaming'
  const hasThreads = detail ? detail.threads.length > 0 : false
  const hasStreamThreads = Object.keys(streamState.threads).length > 0

  const threadMessages = new Map(
    detail?.threads.map((t) => [t.id, t.messages]) ?? [],
  )

  const allThreadIds = [
    ...new Set([
      ...(detail?.threads.map((t) => t.id) ?? []),
      ...Object.keys(streamState.threads),
    ]),
  ]

  const threadMeta = new Map(
    detail?.threads.map((t) => [t.id, t]) ?? [],
  )
  const selectedVisualization = findLatestVisualization(
    allThreadIds,
    threadMessages,
    streamState.threads,
  )
  const hasVisualization = selectedVisualization !== null
  const showSideVisualization =
    allThreadIds.length === 1 && hasVisualization && isVisualizationVisible

  useEffect(() => {
    if (selectedVisualization) {
      setIsVisualizationVisible(true)
    }
  }, [selectedVisualization?.html, selectedVisualization?.threadId])

  // Find the first user message for the context bar
  const contextPrompt = sentPrompt ?? initialPrompt ?? null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="glass-mesh-bg flex h-screen flex-col bg-[#080B14] text-white">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-white/10 bg-[#080B14]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-sm font-black text-[#080B14] shadow-sm"
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
                    className="glass-input h-8 w-64 rounded-lg text-sm font-semibold text-white"
                    maxLength={255}
                  />
                </form>
              ) : (
                <button
                  className="group flex items-center gap-2 text-left"
                  onDoubleClick={startRename}
                  title="Double-click to rename"
                >
                  <p className="truncate text-base font-semibold text-white">
                    {isLoading ? 'Loading...' : detail?.title ?? 'Playground'}
                  </p>
                  {!isLoading && detail && (
                    <Pencil className="hidden size-3 text-white/30 group-hover:inline" />
                  )}
                </button>
              )}
              <p className="font-mono text-xs text-white/30">{id}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isLoading && detail && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewPlayground}
                  disabled={isCreating}
                  className="gap-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">New</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startRename}
                  className="gap-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <Pencil className="size-3.5" />
                  <span className="hidden sm:inline">Rename</span>
                </Button>
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button variant="ghost" size="sm" className="gap-1.5 text-white/60 hover:bg-red-500/10 hover:text-red-400" />
                    }
                  >
                    <Trash2 className="size-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </DialogTrigger>
                  <DialogContent className="glass-card rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-white">Delete playground?</DialogTitle>
                      <DialogDescription className="text-white/60">
                        This will permanently delete{' '}
                        <strong>{detail.title}</strong> and all its threads and
                        messages. This cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" className="rounded-xl border-white/12 bg-white/8 text-white/70 hover:bg-white/12 hover:text-white" />} />
                      <Button
                        variant="destructive"
                        disabled={isDeleting}
                        onClick={handleDelete}
                        className="rounded-xl"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <div className="mx-2 hidden h-6 w-px bg-white/10 sm:block" />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white/70">{displayName}</p>
              <p className="text-xs text-white/40">{user.email}</p>
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

      {/* Error banner */}
      {error && (
        <Alert variant="destructive" className="mx-auto mt-4 max-w-[1600px]">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-white/40">Loading playground...</p>
          </div>
        ) : !hasThreads && !hasStreamThreads ? (
          /* ── Welcome state: no threads yet ── */
          <div className="flex flex-1 items-center justify-center px-5">
            <div className="w-full max-w-xl space-y-6 text-center">
              <MessageSquarePlus className="mx-auto size-12 text-white/20" />
              <div>
                <h2 className="text-xl font-semibold text-white">Start comparing models</h2>
                <p className="mt-2 text-sm text-white/45">
                  Select two or more models below, type a prompt, and see their
                  responses side by side.
                </p>
              </div>
              <div className="glass-card rounded-2xl p-5 text-left">
                <ModelSelector
                  models={models}
                  selected={selectedModels}
                  onChange={setSelectedModels}
                  disabled={isStreaming}
                />
                <div className="mt-5 border-t border-white/10 pt-5">
                  <ToolSelector
                    tools={tools}
                    selected={selectedTools}
                    onChange={handleToolsChange}
                    disabled={isStreaming || isSavingTools}
                  />
                </div>
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
                    className="shrink-0 rounded-xl"
                  >
                    <Square className="mr-1 size-3" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Chat view: context bar + panels + global composer ── */
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Context and tool bar */}
            <div className="shrink-0 border-b border-white/8 bg-white/3 px-5 py-2.5">
              <div className="mx-auto grid max-w-[1600px] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.65fr)]">
                <div className="min-w-0">
                  {contextPrompt ? (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                        Comparing
                      </p>
                      <p className="mt-0.5 truncate text-sm text-white/80">
                        {contextPrompt}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                        Session tools
                      </p>
                      <p className="mt-0.5 truncate text-sm text-white/55">
                        {selectedTools.length} selected
                      </p>
                    </>
                  )}
                </div>
                <ToolSelector
                  tools={tools}
                  selected={selectedTools}
                  onChange={handleToolsChange}
                  disabled={isStreaming || isSavingTools}
                />
              </div>
            </div>

            {/* Thread panels */}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {showSideVisualization ? (
                <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[minmax(340px,1fr)_minmax(420px,0.9fr)]">
                  {renderThreadPanels(
                    allThreadIds,
                    threadMeta,
                    threadMessages,
                    streamState.threads,
                    handleContinue,
                  )}
                  <VisualizationPane
                    visualization={selectedVisualization}
                    isVisible={isVisualizationVisible}
                    onToggle={() => setIsVisualizationVisible((visible) => !visible)}
                  />
                </div>
              ) : (
                <div className="flex h-full min-h-full flex-col gap-4">
                  <div className="min-h-[420px] flex-1 overflow-x-auto overflow-y-hidden">
                    <div
                      className="grid h-full min-w-fit gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(allThreadIds.length, 3)}, minmax(340px, 1fr))`,
                      }}
                    >
                      {renderThreadPanels(
                        allThreadIds,
                        threadMeta,
                        threadMessages,
                        streamState.threads,
                        handleContinue,
                      )}
                    </div>
                  </div>
                  {selectedVisualization && (
                    <div className="mx-auto w-full max-w-[1600px]">
                      <VisualizationPane
                        visualization={selectedVisualization}
                        isVisible={isVisualizationVisible}
                        onToggle={() =>
                          setIsVisualizationVisible((visible) => !visible)
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function renderThreadPanels(
  threadIds: string[],
  threadMeta: Map<string, PlaygroundDetail['threads'][number]>,
  threadMessages: Map<string, Message[]>,
  streamThreads: ReturnType<typeof useChatStream>['streamState']['threads'],
  onContinue: (threadId: string, message: string) => void,
) {
  return threadIds.map((threadId) => {
    const meta = threadMeta.get(threadId)
    const historical = threadMessages.get(threadId) ?? []
    const stream = streamThreads[threadId]

    return (
      <ThreadPanel
        key={threadId}
        displayName={meta?.display_name ?? stream?.modelName ?? threadId}
        provider={meta?.provider ?? stream?.provider ?? 'unknown'}
        modelName={meta?.model_name ?? stream?.modelName ?? threadId}
        messages={historical}
        streamState={stream}
        onContinue={(msg) => onContinue(threadId, msg)}
        disabled={stream?.status === 'streaming'}
      />
    )
  })
}

function VisualizationPane({
  visualization,
  isVisible,
  onToggle,
}: {
  visualization: SelectedVisualization
  isVisible: boolean
  onToggle: () => void
}) {
  const label =
    visualization.source === 'live'
      ? 'Generated visualization'
      : 'Saved visualization'

  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-white/5 p-3 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] ${
        isVisible ? 'min-h-[360px]' : 'min-h-[68px]'
      }`}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#FFFCF6]">
            {visualization.title ?? label}
          </p>
          <p className="truncate font-mono text-[11px] text-white/35">
            {visualization.threadId}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white/45">
            iframe
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
            onClick={onToggle}
            aria-label={isVisible ? 'Hide visualization' : 'Show visualization'}
            title={isVisible ? 'Hide visualization' : 'Show visualization'}
          >
            {isVisible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
        </div>
      </div>
      {isVisible && (
        <div className="min-h-0 flex-1">
          <VisualizationIframe
            html={visualization.html}
            title={visualization.title ?? label}
          />
        </div>
      )}
    </section>
  )
}

function findLatestVisualization(
  threadIds: string[],
  threadMessages: Map<string, Message[]>,
  streamThreads: ReturnType<typeof useChatStream>['streamState']['threads'],
): SelectedVisualization | null {
  let historical: SelectedVisualization | null = null

  for (const threadId of threadIds) {
    const messages = threadMessages.get(threadId) ?? []
    for (const message of messages) {
      const parsed = visualizationFromMessage(message)
      if (parsed) {
        historical = { ...parsed, threadId, source: 'history' }
      }
    }
  }

  let live: SelectedVisualization | null = null
  let hasStreamingLiveVisualization = false
  for (const threadId of threadIds) {
    const stream = streamThreads[threadId]
    if (!stream) continue
    for (const item of stream.timeline) {
      if (item.type !== 'tool') continue
      const parsed = visualizationFromToolEvent(item.event)
      if (parsed) {
        live = { ...parsed, threadId, source: 'live' }
        if (stream.status === 'streaming') {
          hasStreamingLiveVisualization = true
        }
      }
    }
  }

  if (hasStreamingLiveVisualization) return live
  if (live && historical?.html === live.html) return historical
  return live ?? historical
}

function visualizationFromToolEvent(
  event: ToolEvent,
): Pick<SelectedVisualization, 'html' | 'title'> | null {
  if (event.type !== 'tool_end' || !event.vizHtml) {
    return null
  }
  return parseVisualizationHtml(event.vizHtml)
}

function visualizationFromMessage(
  message: Message,
): Pick<SelectedVisualization, 'html' | 'title'> | null {
  if (message.role !== 'tool') {
    return null
  }
  if (message.viz_html) {
    return parseVisualizationHtml(message.viz_html)
  }
  return parseVisualizationHtml(message.content)
}

function parseVisualizationHtml(
  value: string,
): Pick<SelectedVisualization, 'html' | 'title'> | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('<')) {
    return { html: value }
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && 'html' in parsed) {
      const html = (parsed as { html?: unknown }).html
      const title = (parsed as { title?: unknown }).title
      if (typeof html === 'string' && html) {
        return {
          html,
          title: typeof title === 'string' ? title : undefined,
        }
      }
    }
  } catch {
    // Not a JSON visualization payload.
  }

  return null
}
