import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Cpu,
  Info,
  Loader2,
  Send,
  Sparkles,
  Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { VisualizationIframe } from '@/components/VisualizationIframe'
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
  onContinue?: (message: string) => void
  disabled?: boolean
}

type ToolRun = {
  id: string
  tool: string
  status: 'running' | 'done'
  args?: unknown
  outputPreview?: string | null
  vizHtml?: string | null
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
  const [metricNow, setMetricNow] = useState(0)

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

  const isStreaming = streamState?.status === 'streaming'
  const streamDone = streamState?.status === 'done'
  const latestAssistant = findLatestAssistant(messages)
  const headerMetrics = streamState
    ? metricsFromStream(streamState, metricNow)
    : metricsFromMessage(latestAssistant)
  const footerUsage =
    streamState?.status === 'done' && streamState.usage
      ? { usage: streamState.usage, latencyMs: streamState.latencyMs }
      : latestAssistant?.usage
        ? { usage: latestAssistant.usage, latencyMs: latestAssistant.latency_ms }
        : null
  const hasStreamContent =
    streamState && (streamState.text || streamState.timeline.length > 0)
  const showStreamOverlay = hasStreamContent && (isStreaming || (streamDone && messages.length === 0))

  useEffect(() => {
    if (!isStreaming) return
    const interval = window.setInterval(() => setMetricNow(Date.now()), 500)
    return () => window.clearInterval(interval)
  }, [isStreaming])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [inputValue])

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
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      {/* ── Dark model header ─────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#080B14] border-b border-white/8 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-[#5EF2C1]">
              <Cpu className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#FFFCF6]">{displayName}</p>
              <p className="truncate text-xs text-white/40">
                {provider}/{modelName}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {headerMetrics && streamState?.status !== 'error' && (
              <MetricBadge metrics={headerMetrics} isLive={isStreaming} />
            )}
            {streamState?.status === 'error' && (
              <Badge variant="destructive">Error</Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {renderHistoricalMessages(messages, provider)}

        {showStreamOverlay && (
          <div className="space-y-3">
            {renderLiveTimeline(streamState.timeline, provider, isStreaming)}

            {streamState.text && (
              <AssistantFrame>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed">
                  <MarkdownRenderer content={streamState.text} />
                  {isStreaming && (
                    <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-white/40" />
                  )}
                </div>
              </AssistantFrame>
            )}

            {streamState.error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {streamState.error}
              </div>
            )}
          </div>
        )}

        {messages.length === 0 && !showStreamOverlay && (
          <div className="flex h-32 items-center justify-center text-xs text-white/25">
            No messages yet
          </div>
        )}
      </div>

      {/* ── Usage footer ──────────────────────────────────────────────── */}
      {footerUsage && (
        <div className="shrink-0 border-t border-white/8 bg-white/3 px-4 py-2">
          <UsageBar usage={footerUsage.usage} latencyMs={footerUsage.latencyMs} />
        </div>
      )}

      {/* ── Per-thread chat input ─────────────────────────────────────── */}
      {showInput && (
        <div className="shrink-0 border-t border-white/8 bg-white/3 px-3 py-2.5">
          <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/5 p-1.5">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={disabled ? 'Streaming...' : 'Continue...'}
              rows={1}
              className="min-h-8 max-h-[120px] resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0 text-white placeholder:text-white/30"
            />
            <Button
              type="button"
              size="icon"
              disabled={disabled || !inputValue.trim()}
              onClick={handleSend}
              className="size-8 shrink-0 rounded-lg bg-white/15 text-white hover:bg-white/20"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Metric badge (renders on dark header) ────────────────────────────────────

type HeaderMetrics = {
  tpsLabel: string
  ttftLabel: string
}

function MetricBadge({
  metrics,
  isLive,
}: {
  metrics: HeaderMetrics
  isLive: boolean
}) {
  const [showTip, setShowTip] = useState(false)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
        'bg-[#5EF2C1]/12 text-[#5EF2C1] ring-1 ring-[#5EF2C1]/35',
        isLive && 'bg-[#60A5FA]/12 text-[#60A5FA] ring-1 ring-[#60A5FA]/35',
      )}
    >
      {isLive && <Loader2 className="size-3 animate-spin" />}
      <span>{metrics.tpsLabel}</span>
      <span className="text-current/40">·</span>
      <span>{metrics.ttftLabel}</span>
      <span className="relative inline-flex">
        <button
          type="button"
          className="inline-flex size-3.5 items-center justify-center rounded-full text-current/50 outline-none transition hover:text-current"
          aria-label="Metrics detail"
          aria-expanded={showTip}
          onBlur={() => setShowTip(false)}
          onClick={() => setShowTip((v) => !v)}
          onFocus={() => setShowTip(true)}
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
        >
          <Info className="size-3" />
          <span
            role="tooltip"
            className={cn(
              'pointer-events-none absolute right-0 top-full z-20 mt-1 w-48 whitespace-normal break-words rounded-xl border border-white/12 bg-white/10 backdrop-blur-xl px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-white/70 shadow-lg shadow-black/20',
              showTip ? 'block' : 'hidden',
            )}
          >
            Speed: {metrics.tpsLabel}
            <br />
            Time to first token: {metrics.ttftLabel}
          </span>
        </button>
      </span>
    </span>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findLatestAssistant(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') return messages[index]
  }
  return undefined
}

function metricsFromStream(
  streamState: ThreadStreamState,
  now: number,
): HeaderMetrics | null {
  if (streamState.status === 'error') return null

  const elapsedMs =
    streamState.status === 'done' && streamState.latencyMs != null
      ? streamState.latencyMs
      : Math.max(0, now - streamState.startedAt)
  const finalOutputTokens =
    streamState.status === 'done' ? outputTokensFromUsage(streamState.usage) : null
  const liveOutputTokens =
    streamState.status === 'streaming'
      ? estimateTokens(streamState.text + streamState.thinking)
      : finalOutputTokens
  const tokens = finalOutputTokens ?? liveOutputTokens
  const ttftMs = readTtftMs(streamState.usage) ?? streamState.ttftMs

  if (streamState.status === 'done' && tokens == null) return null

  return {
    tpsLabel:
      streamState.status === 'streaming' && tokens === 0
        ? '...'
        : formatTps(tokensPerSecond(tokens, elapsedMs), streamState.status === 'streaming'),
    ttftLabel: ttftMs != null ? formatDuration(ttftMs) : '...',
  }
}

function metricsFromMessage(message?: Message): HeaderMetrics | null {
  if (!message?.usage || message.latency_ms == null) return null

  const tokens = outputTokensFromUsage(message.usage)
  if (tokens == null) return null

  return {
    tpsLabel: formatTps(tokensPerSecond(tokens, message.latency_ms), false),
    ttftLabel: readTtftMs(message.usage) != null
      ? formatDuration(readTtftMs(message.usage) ?? 0)
      : 'n/a',
  }
}

function outputTokensFromUsage(usage: Record<string, unknown> | null) {
  if (!usage) return null

  const output = usage.output_tokens ?? usage.completion_tokens ?? usage.total_tokens
  return typeof output === 'number' && Number.isFinite(output) ? output : null
}

function readTtftMs(usage: Record<string, unknown> | null) {
  const perf = usage?.perf
  if (!perf || typeof perf !== 'object') return null

  const ttft = (perf as Record<string, unknown>).ttft_ms
  return typeof ttft === 'number' && Number.isFinite(ttft) ? ttft : null
}

function estimateTokens(text: string) {
  return Math.max(0, Math.round(text.length / 4))
}

function tokensPerSecond(tokens: number | null, elapsedMs: number | null) {
  if (tokens == null || elapsedMs == null || elapsedMs <= 0) return null
  return tokens / (elapsedMs / 1000)
}

function formatTps(value: number | null, estimated: boolean) {
  if (value == null || !Number.isFinite(value)) return '...'
  const prefix = estimated ? '~' : ''
  return `${prefix}${value.toFixed(1)} tok/s`
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
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
        <div className="max-w-[85%] rounded-[18px] bg-white/8 border border-white/12 px-3.5 py-2.5 text-sm text-white">
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

        <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white">
          <MarkdownRenderer content={message.content} />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-white/30">
          {message.model && <span>{message.model}</span>}
          {message.latency_ms != null && <span>{message.latency_ms}ms</span>}
          {message.usage &&
            typeof message.usage === 'object' &&
            'total_tokens' in message.usage && (
              <span>{formatNumber((message.usage as Record<string, number>).total_tokens)} tok</span>
            )}
        </div>
      </div>
    </AssistantFrame>
  )
}

function AssistantFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-white/70">
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
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-violet-300">
          <Sparkles className="size-3.5 shrink-0" />
          <span className={cn(isLive && !expanded && 'text-shimmer')}>
            {liveLabel}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="size-3.5 shrink-0 text-violet-400" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-violet-400" />
        )}
      </button>
      {expanded && (
        <pre
          className={cn(
            'mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-white/5 px-2.5 py-2 text-xs leading-relaxed text-violet-200',
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
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/8 text-amber-400 ring-1 ring-amber-500/20">
            {hasActive ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wrench className="size-3.5" />
            )}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                'block text-xs font-semibold text-amber-200',
                isLive &&
                  hasActive &&
                  'text-shimmer [--shimmer-base:#92400e] [--shimmer-highlight:#fef3c7] [--shimmer-mid:#ea580c]',
              )}
            >
              {hasActive ? 'Using tools' : 'Tools'}
            </span>
            <span className="block truncate text-[11px] text-amber-300/70">
              {toolSummary} · {statusText}
            </span>
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="size-3.5 shrink-0 text-amber-400" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-amber-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {runs.map((run, index) => {
            const viz = extractVisualization(run)
            return (
              <div
                key={`${run.id}-${index}`}
                className="rounded-lg border border-amber-500/15 bg-white/5 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {run.status === 'running' ? (
                      <CircleDashed className="size-3.5 shrink-0 animate-spin text-amber-400" />
                    ) : (
                      <CheckCircle2 className="size-3.5 shrink-0 text-[#047857]" />
                    )}
                    <span className="truncate font-mono text-[11px] text-white/60">
                      {run.tool}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/30">
                    {run.status}
                  </span>
                </div>

                {run.args !== undefined && !viz && (
                  <ToolDetail label="input" value={run.args} />
                )}
                {viz ? (
                  <div className="mt-2">
                    <VisualizationIframe html={viz.html} title={viz.title} />
                  </div>
                ) : (
                  run.outputPreview && (
                    <ToolDetail label="output" value={run.outputPreview} />
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ToolDetail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="mt-2 rounded-lg bg-white/5 px-2 py-1.5">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/30">
        {label}
      </p>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-white/50">
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
      vizHtml: event.vizHtml ?? existing.vizHtml,
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
      vizHtml: extractVizFromContent(message) ?? existing.vizHtml,
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

function extractVisualization(
  run: ToolRun,
): { html: string; title?: string } | null {
  if (!run.vizHtml) return null
  try {
    const output = JSON.parse(run.vizHtml)
    if (output && typeof output.html === 'string') {
      return { html: output.html, title: output.title }
    }
  } catch {
    // vizHtml might be raw HTML
    if (run.vizHtml.trim().startsWith('<')) {
      return { html: run.vizHtml }
    }
  }
  return null
}

function extractVizFromContent(message: Message): string | null {
  if (message.role !== 'tool' || message.tool_name !== 'generate_visualization')
    return null
  try {
    const output = JSON.parse(message.content)
    if (output && typeof output.html === 'string') {
      return message.content
    }
  } catch {
    // not JSON
  }
  return null
}

// -- Usage -------------------------------------------------------------------

function UsageBar({
  usage,
  latencyMs,
}: {
  usage: Record<string, unknown>
  latencyMs: number | null
}) {
  const input = usage.input_tokens ?? usage.prompt_tokens
  const output = usage.output_tokens ?? usage.completion_tokens
  const total = usage.total_tokens

  if (!input && !output && !total && latencyMs == null) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/40">
      {input != null && <span>Input {formatNumber(Number(input))}</span>}
      {output != null && <span>Output {formatNumber(Number(output))}</span>}
      {total != null && <span>Total {formatNumber(Number(total))}</span>}
      {latencyMs != null && <span>{formatDuration(latencyMs)}</span>}
    </div>
  )
}
