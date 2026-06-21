import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Cpu,
  Loader2,
  Send,
  Sparkles,
  Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import type { Message } from '@/lib/api'
import type {
  StreamTimelineEvent,
  ThreadStreamState,
  ToolEvent,
} from '@/lib/use-chat-stream'
import { cn } from '@/lib/utils'

type Props = {
  displayName: string
  provider: string
  modelName: string
  messages: Message[]
  streamState?: ThreadStreamState
  /** When set, shows a per-thread input. Called with the thread's message. */
  onContinue?: (message: string) => void
  /** Disable the per-thread input (e.g. while any thread is streaming). */
  disabled?: boolean
}

type ToolRun = {
  id: string
  tool: string
  status: 'running' | 'done'
  args?: unknown
  outputPreview?: string | null
}

export function ThreadPanel({
  displayName,
  provider,
  modelName,
  messages,
  streamState,
  onContinue,
  disabled,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [inputValue, setInputValue] = useState('')

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [
    messages.length,
    streamState?.text,
    streamState?.timeline.length,
  ])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [inputValue])

  const isStreaming = streamState?.status === 'streaming'
  const streamDone = streamState?.status === 'done'
  const hasStreamContent =
    streamState && (streamState.text || streamState.timeline.length > 0)
  // Show streaming overlay while actively streaming, or while done but
  // historical messages haven't caught up yet (detail not refreshed).
  const showStreamOverlay = hasStreamContent && (isStreaming || (streamDone && messages.length === 0))

  // Show per-thread input when onContinue is provided and we have messages
  const showInput = onContinue && messages.length > 0

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (inputValue.trim() && !disabled) {
        onContinue?.(inputValue.trim())
        setInputValue('')
      }
    }
  }

  function handleSend() {
    if (inputValue.trim() && !disabled) {
      onContinue?.(inputValue.trim())
      setInputValue('')
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5">
      {/* Thread header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 bg-slate-50/70 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200">
            <Cpu className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{displayName}</p>
            <p className="truncate text-xs text-slate-500">
              {provider}/{modelName}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {isStreaming && (
            <Badge variant="secondary" className="gap-1 bg-sky-50 text-sky-700 ring-1 ring-sky-100">
              <Loader2 className="size-3 animate-spin" />
              Live
            </Badge>
          )}
          {streamState?.status === 'done' && streamState.latencyMs != null && (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              {streamState.latencyMs}ms
            </Badge>
          )}
          {streamState?.status === 'error' && (
            <Badge variant="destructive">Error</Badge>
          )}
          <Badge variant="secondary" className="bg-white text-slate-500 ring-1 ring-slate-200">
            {messages.length}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {/* Historical messages */}
        {renderHistoricalMessages(messages, provider)}

        {/* Live streaming content */}
        {showStreamOverlay && (
          <div className="space-y-3">
            {renderLiveTimeline(streamState.timeline, provider, isStreaming)}

            {streamState.text && (
              <AssistantFrame>
                <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm leading-relaxed shadow-sm shadow-slate-900/5">
                  <MarkdownRenderer content={streamState.text} />
                  {isStreaming && (
                    <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-slate-400" />
                  )}
                </div>
              </AssistantFrame>
            )}

            {streamState.error && (
              <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {streamState.error}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !showStreamOverlay && (
          <div className="flex h-32 items-center justify-center text-xs text-slate-400">
            No messages yet
          </div>
        )}
      </div>

      {/* Usage footer */}
      {streamState?.status === 'done' && streamState.usage && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2">
          <UsageBar usage={streamState.usage} />
        </div>
      )}

      {/* Per-thread chat input */}
      {showInput && (
        <div className="border-t border-slate-200/70 bg-white px-3 py-2.5">
          <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={disabled ? 'Streaming...' : 'Continue conversation...'}
              rows={1}
              className="min-h-8 max-h-[120px] resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={disabled || !inputValue.trim()}
              onClick={handleSend}
              className="size-8 shrink-0 bg-white"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// -- Message rendering --------------------------------------------------------

function renderHistoricalMessages(messages: Message[], provider: string) {
  const nodes: ReactNode[] = []
  let toolBuffer: Message[] = []
  let hasThinkingSinceLastAssistant = false

  messages.forEach((message) => {
    if (message.role === 'tool') {
      toolBuffer.push(message)
      return
    }

    if (toolBuffer.length > 0) {
      nodes.push(
        <ToolActivity
          key={`tools-${toolBuffer[0].id}`}
          runs={toolRunsFromMessages(toolBuffer)}
        />,
      )
      toolBuffer = []
    }

    if (message.role === 'thinking') {
      hasThinkingSinceLastAssistant = true
    }

    nodes.push(
      <MessageBubble
        key={message.id}
        message={message}
        provider={provider}
        showAssistantThinking={!hasThinkingSinceLastAssistant}
      />,
    )

    if (message.role === 'assistant' || message.role === 'user') {
      hasThinkingSinceLastAssistant = false
    }
  })

  if (toolBuffer.length > 0) {
    nodes.push(
      <ToolActivity
        key={`tools-${toolBuffer[0].id}`}
        runs={toolRunsFromMessages(toolBuffer)}
      />,
    )
  }

  return nodes
}

function renderLiveTimeline(
  timeline: StreamTimelineEvent[],
  provider: string,
  isStreaming: boolean,
) {
  const nodes: ReactNode[] = []
  let toolBuffer: ToolEvent[] = []

  function flushTools() {
    if (toolBuffer.length === 0) return
    nodes.push(
      <ToolActivity
        key={`live-tools-${nodes.length}`}
        runs={toolRunsFromEvents(toolBuffer)}
        isLive={isStreaming}
      />,
    )
    toolBuffer = []
  }

  timeline.forEach((event, index) => {
    if (event.type === 'tool') {
      toolBuffer.push(event.event)
      return
    }

    flushTools()
    const isCurrentThinking = isStreaming && index === timeline.length - 1
    nodes.push(
      <ThinkingPanel
        key={event.id}
        content={formatThinking(provider, { [event.kind]: event.content }, event.content)}
        isLive={isCurrentThinking}
        headerSeed={event.id}
      />,
    )
  })

  flushTools()
  return nodes
}

function MessageBubble({
  message,
  provider,
  showAssistantThinking,
}: {
  message: Message
  provider: string
  showAssistantThinking: boolean
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-slate-950 px-3 py-2 text-sm text-white shadow-sm shadow-slate-950/10">
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>
      </div>
    )
  }

  if (message.role === 'tool') {
    return <ToolActivity runs={toolRunsFromMessages([message])} />
  }

  if (message.role === 'thinking') {
    return (
      <ThinkingPanel
        content={formatThinking(provider, message.thinking, message.content)}
        headerSeed={String(message.id)}
      />
    )
  }

  return (
    <AssistantFrame>
      <div className="space-y-2">
        {showAssistantThinking && message.thinking && (
          <ThinkingPanel
            content={formatThinking(provider, message.thinking, message.content)}
            headerSeed={String(message.id)}
          />
        )}

        <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm leading-relaxed shadow-sm shadow-slate-900/5">
          <MarkdownRenderer content={message.content} />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-slate-400">
          {message.model && <span>{message.model}</span>}
          {message.latency_ms != null && <span>{message.latency_ms}ms</span>}
          {message.usage &&
            typeof message.usage === 'object' &&
            'total_tokens' in message.usage && (
              <span>{(message.usage as Record<string, number>).total_tokens} tok</span>
            )}
        </div>
      </div>
    </AssistantFrame>
  )
}

function AssistantFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-slate-950 text-[10px] font-bold text-white">
        AI
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function formatThinking(
  provider: string,
  thinking: Record<string, unknown> | null,
  fallback: string,
) {
  const preferredKey = provider === 'openai' ? 'summary' : 'reasoning'
  const preferred = thinking?.[preferredKey]
  if (typeof preferred === 'string' && preferred.trim()) return preferred

  const alternate = provider === 'openai' ? thinking?.reasoning : thinking?.summary
  if (typeof alternate === 'string' && alternate.trim()) return alternate

  if (fallback.trim()) return fallback
  if (thinking) return formatValue(thinking)
  return ''
}

const THINKING_PHRASES = [
  'Exploring the reasoning path',
  'Working through the intermediate steps',
  'Tracing the model thought process',
  'Following the chain of evidence',
  'Reviewing the hidden reasoning trail',
]

function thinkingPhraseForSeed(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return THINKING_PHRASES[hash % THINKING_PHRASES.length]
}

function randomThinkingPhrase() {
  return THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]
}

// -- Thinking ----------------------------------------------------------------

function ThinkingPanel({
  content,
  isLive = false,
  headerSeed,
}: {
  content: string
  isLive?: boolean
  headerSeed?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [liveLabel] = useState(() =>
    headerSeed ? thinkingPhraseForSeed(headerSeed) : randomThinkingPhrase(),
  )

  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-violet-700">
          <Sparkles className="size-3.5 shrink-0" />
          <span className={cn(isLive && !expanded && 'text-shimmer')}>
            {liveLabel}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="size-3.5 shrink-0 text-violet-500" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-violet-500" />
        )}
      </button>
      {expanded && (
        <pre
          className={cn(
            'mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-white/70 px-2.5 py-2 text-xs leading-relaxed text-violet-900',
            isLive && 'text-shimmer',
          )}
        >
          {content}
        </pre>
      )}
    </div>
  )
}

// -- Tools -------------------------------------------------------------------

function ToolActivity({
  runs,
  isLive = false,
}: {
  runs: ToolRun[]
  isLive?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  if (runs.length === 0) return null

  const activeCount = runs.filter((run) => run.status === 'running').length
  const completedCount = runs.length - activeCount
  const hasActive = activeCount > 0
  const toolSummary = summarizeTools(runs)
  const statusText = hasActive
    ? `${activeCount} running${completedCount ? `, ${completedCount} done` : ''}`
    : `${completedCount} completed`

  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 shadow-sm shadow-amber-950/5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white text-amber-700 ring-1 ring-amber-100">
            {hasActive ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wrench className="size-3.5" />
            )}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                'block text-xs font-semibold text-amber-900',
                isLive &&
                  hasActive &&
                  'text-shimmer [--shimmer-base:#92400e] [--shimmer-highlight:#fef3c7] [--shimmer-mid:#ea580c]',
              )}
            >
              {hasActive ? 'Using tools' : 'Tools'}
            </span>
            <span className="block truncate text-[11px] text-amber-700/80">
              {toolSummary} · {statusText}
            </span>
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="size-3.5 shrink-0 text-amber-700" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-amber-700" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {runs.map((run, index) => (
            <div
              key={`${run.id}-${index}`}
              className="rounded-md border border-amber-100 bg-white/80 px-2.5 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {run.status === 'running' ? (
                    <CircleDashed className="size-3.5 shrink-0 animate-spin text-amber-600" />
                  ) : (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                  )}
                  <span className="truncate font-mono text-[11px] text-slate-700">
                    {run.tool}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                  {run.status}
                </span>
              </div>

              {run.args !== undefined && (
                <ToolDetail label="input" value={run.args} />
              )}
              {run.outputPreview && (
                <ToolDetail label="output" value={run.outputPreview} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ToolDetail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-600">
        {formatValue(value)}
      </pre>
    </div>
  )
}

function toolRunsFromEvents(events: ToolEvent[]): ToolRun[] {
  const runs = new Map<string, ToolRun>()

  events.forEach((event, index) => {
    const id = event.callId || `${event.tool}-${index}`
    const existing = runs.get(id) ?? {
      id,
      tool: event.tool,
      status: 'running' as const,
    }

    if (event.type === 'tool_start') {
      runs.set(id, {
        ...existing,
        tool: event.tool,
        status: existing.status,
        args: event.args,
      })
      return
    }

    runs.set(id, {
      ...existing,
      tool: event.tool,
      status: 'done',
      outputPreview: cleanPreview(event.outputPreview),
    })
  })

  return [...runs.values()]
}

function toolRunsFromMessages(messages: Message[]): ToolRun[] {
  const runs = new Map<string, ToolRun>()

  messages.forEach((message) => {
    const tool = message.tool_name || parseToolName(message.content) || 'tool'
    const id = message.tool_call_id || `message-${message.id}`
    const existing = runs.get(id) ?? {
      id,
      tool,
      status: 'done' as const,
    }
    const isDone =
      message.content.toLowerCase().includes('finished') ||
      message.output_preview?.startsWith('tool_end:')

    runs.set(id, {
      ...existing,
      tool,
      status: isDone ? 'done' : existing.status,
      args: message.tool_input ?? existing.args,
      outputPreview: cleanPreview(message.output_preview) ?? existing.outputPreview,
    })
  })

  return [...runs.values()]
}

function summarizeTools(runs: ToolRun[]) {
  const counts = runs.reduce<Record<string, number>>((acc, run) => {
    acc[run.tool] = (acc[run.tool] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(counts)
    .map(([tool, count]) => (count > 1 ? `${tool} x${count}` : tool))
    .join(', ')
}

function cleanPreview(value?: string | null) {
  if (!value || /^tool_(start|end):/.test(value)) return null
  return value
}

function parseToolName(content: string) {
  const match = content.match(/\[(?:calling|finished)\s+(.+)]/i)
  return match?.[1]
}

function formatValue(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

// -- Usage -------------------------------------------------------------------

function UsageBar({ usage }: { usage: Record<string, unknown> }) {
  const input = usage.input_tokens ?? usage.prompt_tokens
  const output = usage.output_tokens ?? usage.completion_tokens
  const total = usage.total_tokens

  if (!input && !output && !total) return null

  return (
    <div className="flex items-center gap-3 text-[11px] text-slate-500">
      {input != null && <span>in {String(input)}</span>}
      {output != null && <span>out {String(output)}</span>}
      {total != null && <span>total {String(total)}</span>}
    </div>
  )
}
