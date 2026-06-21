import { API_BASE_URL } from '@/lib/api'

// ── SSE event types from the backend ─────────────────────────────────────────

export type SSEEvent =
  | { type: 'thread_start'; thread_id: string }
  | { type: 'text_delta'; thread_id: string; delta: string }
  | { type: 'thinking_delta'; thread_id: string; delta: string }
  | { type: 'tool_start'; thread_id: string; tool: string; call_id: string; args: unknown }
  | { type: 'tool_end'; thread_id: string; tool: string; call_id: string }
  | { type: 'thread_done'; thread_id: string; latency_ms: number; content: string; provider: string; model: string; usage: Record<string, unknown> | null; thinking: Record<string, unknown> | null; output_delta_count: number | null }
  | { type: 'error'; thread_id: string; error: string }
  | { type: 'all_done' }

// ── Options ──────────────────────────────────────────────────────────────────

export type StreamChatOptions = {
  token: string
  path: string
  body: Record<string, unknown>
  signal?: AbortSignal
}

/**
 * POST to an SSE endpoint and yield parsed events.
 *
 * Uses fetch + ReadableStream because EventSource only supports GET
 * and can't set Authorization headers or send a POST body.
 */
export async function* streamSSE(options: StreamChatOptions): AsyncGenerator<SSEEvent> {
  const { token, path, body, signal } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    let message = `Stream failed (${response.status})`
    try {
      const errBody = (await response.json()) as { detail?: string }
      if (errBody.detail) message = errBody.detail
    } catch {
      // use default message
    }
    throw new Error(message)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE frames are separated by blank lines (\n\n)
      const frames = buffer.split('\n\n')
      // Last element is either empty or an incomplete frame
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const event = parseSSEFrame(frame)
        if (event) yield event
      }
    }

    // Process any remaining buffered data
    if (buffer.trim()) {
      const event = parseSSEFrame(buffer)
      if (event) yield event
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Parse a single SSE frame (one or more lines ending with \n\n).
 * Extracts the `data:` payload and parses it as JSON.
 */
function parseSSEFrame(frame: string): SSEEvent | null {
  for (const line of frame.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('data: ')) {
      const json = trimmed.slice(6)
      if (json === '[DONE]') return null
      try {
        return JSON.parse(json) as SSEEvent
      } catch {
        // skip malformed JSON
      }
    }
  }
  return null
}
