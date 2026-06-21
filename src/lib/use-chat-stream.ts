import { useCallback, useReducer, useRef } from 'react'

import {
  continueChatPayload,
  multiChatPayload,
  type ModelSelect,
} from '@/lib/api'
import { streamSSE, type SSEEvent } from '@/lib/sse'

// ── Types ────────────────────────────────────────────────────────────────────

export type ToolEvent = {
  type: 'tool_start' | 'tool_end'
  tool: string
  callId: string
  args?: unknown
}

export type ThreadStreamState = {
  status: 'idle' | 'streaming' | 'done' | 'error'
  text: string
  thinking: string
  toolEvents: ToolEvent[]
  latencyMs: number | null
  usage: Record<string, unknown> | null
  error: string | null
}

export type ChatStatus = 'idle' | 'streaming' | 'done'

// ── Reducer ──────────────────────────────────────────────────────────────────

type State = {
  threads: Record<string, ThreadStreamState>
  chatStatus: ChatStatus
}

type Action =
  | { type: 'START_STREAM' }
  | { type: 'TEXT_DELTA'; threadId: string; delta: string }
  | { type: 'THINKING_DELTA'; threadId: string; delta: string }
  | { type: 'TOOL_EVENT'; threadId: string; event: ToolEvent }
  | { type: 'THREAD_DONE'; threadId: string; latencyMs: number; usage: Record<string, unknown> | null; content: string | null }
  | { type: 'THREAD_ERROR'; threadId: string; error: string }
  | { type: 'ALL_DONE' }
  | { type: 'RESET' }

const EMPTY_THREAD: ThreadStreamState = {
  status: 'streaming',
  text: '',
  thinking: '',
  toolEvents: [],
  latencyMs: null,
  usage: null,
  error: null,
}

function initState(): State {
  return { threads: {}, chatStatus: 'idle' }
}

/** Ensure a thread entry exists, creating it lazily on first event.
 *  If the thread exists but is already done/error, reset it for a new turn. */
function ensureThread(
  threads: Record<string, ThreadStreamState>,
  threadId: string,
): Record<string, ThreadStreamState> {
  const existing = threads[threadId]
  if (!existing) {
    return { ...threads, [threadId]: { ...EMPTY_THREAD } }
  }
  // If the thread is done/error, this is a new turn — reset it
  if (existing.status === 'done' || existing.status === 'error') {
    return { ...threads, [threadId]: { ...EMPTY_THREAD } }
  }
  // Thread is actively streaming — keep as-is
  return threads
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_STREAM':
      // Don't clear threads — concurrent streams must coexist
      return { ...state, chatStatus: 'streaming' }

    case 'TEXT_DELTA': {
      const threads = ensureThread(state.threads, action.threadId)
      const t = threads[action.threadId]
      return {
        ...state,
        threads: {
          ...threads,
          [action.threadId]: { ...t, text: t.text + action.delta },
        },
      }
    }

    case 'THINKING_DELTA': {
      const threads = ensureThread(state.threads, action.threadId)
      const t = threads[action.threadId]
      return {
        ...state,
        threads: {
          ...threads,
          [action.threadId]: { ...t, thinking: t.thinking + action.delta },
        },
      }
    }

    case 'TOOL_EVENT': {
      const threads = ensureThread(state.threads, action.threadId)
      const t = threads[action.threadId]
      return {
        ...state,
        threads: {
          ...threads,
          [action.threadId]: {
            ...t,
            toolEvents: [...t.toolEvents, action.event],
          },
        },
      }
    }

    case 'THREAD_DONE': {
      const threads = ensureThread(state.threads, action.threadId)
      const t = threads[action.threadId]
      // Use content from thread_done as fallback if no text_delta events were received
      const text = t.text || action.content || ''
      return {
        ...state,
        threads: {
          ...threads,
          [action.threadId]: {
            ...t,
            status: 'done',
            text,
            latencyMs: action.latencyMs,
            usage: action.usage,
          },
        },
      }
    }

    case 'THREAD_ERROR': {
      const threads = ensureThread(state.threads, action.threadId)
      const t = threads[action.threadId]
      return {
        ...state,
        threads: {
          ...threads,
          [action.threadId]: { ...t, status: 'error', error: action.error },
        },
      }
    }

    case 'ALL_DONE': {
      // Only mark done when every thread has finished
      const anyStreaming = Object.values(state.threads).some(
        (t) => t.status === 'streaming',
      )
      if (anyStreaming) return state
      return { ...state, chatStatus: 'done' }
    }

    case 'RESET':
      return initState()

    default:
      return state
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChatStream(token: string, playgroundId: string) {
  const [state, dispatch] = useReducer(reducer, null, initState)
  const abortRef = useRef<AbortController | null>(null)
  const startedThreadIds = useRef<string[]>([])

  /** Send a message to multiple models (fanout). */
  const sendMultiChat = useCallback(
    async (message: string, models: ModelSelect[]) => {
      startedThreadIds.current = []
      dispatch({ type: 'START_STREAM' })

      const controller = new AbortController()
      abortRef.current = controller

      const payload = multiChatPayload(playgroundId, message, models)

      try {
        for await (const event of streamSSE({
          token,
          path: payload.path,
          body: payload.body,
          signal: controller.signal,
        })) {
          processEvent(event, dispatch)
          // Track thread IDs as they appear
          if ('thread_id' in event && !startedThreadIds.current.includes(event.thread_id)) {
            startedThreadIds.current.push(event.thread_id)
          }
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return
        const errorMsg =
          err instanceof Error ? err.message : 'Stream failed'
        for (const tid of startedThreadIds.current) {
          dispatch({ type: 'THREAD_ERROR', threadId: tid, error: errorMsg })
        }
        startedThreadIds.current = []
        dispatch({ type: 'ALL_DONE' })
      }
    },
    [token, playgroundId],
  )

  /** Continue a single thread with a follow-up message. */
  const sendContinueChat = useCallback(
    async (threadId: string, message: string) => {
      dispatch({ type: 'START_STREAM' })

      const controller = new AbortController()
      abortRef.current = controller

      const payload = continueChatPayload(playgroundId, threadId, message)

      try {
        for await (const event of streamSSE({
          token,
          path: payload.path,
          body: payload.body,
          signal: controller.signal,
        })) {
          processEvent(event, dispatch)
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return
        const errorMsg =
          err instanceof Error ? err.message : 'Stream failed'
        dispatch({ type: 'THREAD_ERROR', threadId, error: errorMsg })
        dispatch({ type: 'ALL_DONE' })
      }
    },
    [token, playgroundId],
  )

  /** Abort any in-flight stream. */
  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    dispatch({ type: 'ALL_DONE' })
  }, [])

  /** Reset streaming state (e.g. before a new chat). */
  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    dispatch({ type: 'RESET' })
  }, [])

  return {
    streamState: state,
    sendMultiChat,
    sendContinueChat,
    abort,
    reset,
  }
}

// ── Event dispatcher ─────────────────────────────────────────────────────────

function processEvent(event: SSEEvent, dispatch: (action: Action) => void) {
  switch (event.type) {
    case 'thread_start':
      break

    case 'text_delta':
      dispatch({
        type: 'TEXT_DELTA',
        threadId: event.thread_id,
        delta: event.delta,
      })
      break

    case 'thinking_delta':
      dispatch({
        type: 'THINKING_DELTA',
        threadId: event.thread_id,
        delta: event.delta,
      })
      break

    case 'tool_start':
      dispatch({
        type: 'TOOL_EVENT',
        threadId: event.thread_id,
        event: {
          type: 'tool_start',
          tool: event.tool,
          callId: event.call_id,
          args: event.args,
        },
      })
      break

    case 'tool_end':
      dispatch({
        type: 'TOOL_EVENT',
        threadId: event.thread_id,
        event: {
          type: 'tool_end',
          tool: event.tool,
          callId: event.call_id,
        },
      })
      break

    case 'thread_done':
      dispatch({
        type: 'THREAD_DONE',
        threadId: event.thread_id,
        latencyMs: event.latency_ms,
        usage: event.usage,
        content: event.content ?? null,
      })
      break

    case 'error':
      dispatch({
        type: 'THREAD_ERROR',
        threadId: event.thread_id,
        error: event.error,
      })
      break

    case 'all_done':
      dispatch({ type: 'ALL_DONE' })
      break
  }
}
