import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
  Send,
  Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import type { Message } from '@/lib/api'
import type { ThreadStreamState } from '@/lib/use-chat-stream'

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
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({})
  const [inputValue, setInputValue] = useState('')

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length, streamState?.text])

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
    streamState && (streamState.text || streamState.thinking || streamState.toolEvents.length > 0)
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
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Thread header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-slate-400" />
          <span className="text-sm font-semibold">{displayName}</span>
          <span className="text-xs text-slate-400">
            {provider}/{modelName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-600">
              <Loader2 className="size-3 animate-spin" />
              Streaming
            </Badge>
          )}
          {streamState?.status === 'done' && streamState.latencyMs != null && (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
              {streamState.latencyMs}ms
            </Badge>
          )}
          {streamState?.status === 'error' && (
            <Badge variant="destructive">Error</Badge>
          )}
          <Badge variant="secondary">
            {messages.length} msg{messages.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Historical messages */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Live streaming content */}
        {showStreamOverlay && (
          <div className="space-y-2">
            {/* Tool events */}
            {streamState.toolEvents.map((evt, i) => (
              <div
                key={`${evt.callId}-${evt.type}-${i}`}
                className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700"
              >
                <Wrench className="size-3" />
                <span>
                  {evt.type === 'tool_start'
                    ? `Calling ${evt.tool}...`
                    : `${evt.tool} done`}
                </span>
              </div>
            ))}

            {/* Thinking */}
            {streamState.thinking && (
              <div className="rounded-md bg-violet-50 px-3 py-2">
                <button
                  className="flex items-center gap-1 text-xs font-medium text-violet-600"
                  onClick={() =>
                    setExpandedThinking((prev) => ({
                      ...prev,
                      [-1]: !prev[-1],
                    }))
                  }
                >
                  {expandedThinking[-1] ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )}
                  Thinking...
                </button>
                {expandedThinking[-1] && (
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-violet-800">
                    {streamState.thinking}
                  </pre>
                )}
              </div>
            )}

            {/* Streaming text */}
            {streamState.text && (
              <div className="flex gap-2">
                <div className="shrink-0 mt-0.5 grid size-6 place-items-center rounded-full bg-slate-950 text-[10px] font-bold text-white">
                  AI
                </div>
                <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed">
                  <MarkdownRenderer content={streamState.text} />
                  {isStreaming && (
                    <span className="ml-0.5 inline-block size-1.5 animate-pulse rounded-full bg-slate-400" />
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {streamState.error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
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
        <div className="border-t border-slate-100 px-4 py-1.5">
          <UsageBar usage={streamState.usage} />
        </div>
      )}

      {/* Per-thread chat input */}
      {showInput && (
        <div className="border-t border-slate-100 px-3 py-2">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={disabled ? 'Streaming...' : 'Continue conversation...'}
              rows={1}
              className="min-h-[36px] max-h-[120px] resize-none text-sm"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={disabled || !inputValue.trim()}
              onClick={handleSend}
              className="shrink-0"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const [expandedThinking, setExpandedThinking] = useState(false)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-slate-950 px-3 py-2 text-sm text-white">
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>
      </div>
    )
  }

  if (message.role === 'tool') {
    return (
      <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
        <Wrench className="size-3" />
        <span>{message.content}</span>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex gap-2">
      <div className="shrink-0 mt-0.5 grid size-6 place-items-center rounded-full bg-slate-950 text-[10px] font-bold text-white">
        AI
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Thinking block */}
        {message.thinking && (
          <div className="rounded-md bg-violet-50 px-3 py-2">
            <button
              className="flex items-center gap-1 text-xs font-medium text-violet-600"
              onClick={() => setExpandedThinking(!expandedThinking)}
            >
              {expandedThinking ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              Thinking
            </button>
            {expandedThinking && (
              <pre className="mt-1 whitespace-pre-wrap text-xs text-violet-800">
                {typeof message.thinking === 'string'
                  ? message.thinking
                  : JSON.stringify(message.thinking, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Content */}
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed">
          <MarkdownRenderer content={message.content} />
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {message.model && <span>{message.model}</span>}
          {message.latency_ms != null && <span>{message.latency_ms}ms</span>}
          {message.usage &&
            typeof message.usage === 'object' &&
            'total_tokens' in message.usage && (
              <span>{(message.usage as Record<string, number>).total_tokens} tok</span>
            )}
        </div>
      </div>
    </div>
  )
}

// ── UsageBar ─────────────────────────────────────────────────────────────────

function UsageBar({ usage }: { usage: Record<string, unknown> }) {
  const input = usage.input_tokens ?? usage.prompt_tokens
  const output = usage.output_tokens ?? usage.completion_tokens
  const total = usage.total_tokens

  if (!input && !output && !total) return null

  return (
    <div className="flex items-center gap-3 text-[11px] text-slate-400">
      {input != null && <span>in: {String(input)}</span>}
      {output != null && <span>out: {String(output)}</span>}
      {total != null && <span>total: {String(total)}</span>}
    </div>
  )
}
