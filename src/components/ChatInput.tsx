import { useRef, useEffect } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = 'Type a message...',
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (value.trim() && !disabled) {
        onSubmit()
      }
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (value.trim() && !disabled) {
      onSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="glass-input min-h-[40px] max-h-[200px] resize-none rounded-xl text-white placeholder:text-white/30 focus-visible:border-[#5EF2C1]/40"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !value.trim()}
        className="shrink-0 rounded-xl bg-white/15 text-white shadow-[0_6px_20px_rgba(0,0,0,0.2)] hover:bg-white/20"
      >
        <Send className="size-4" />
      </Button>
    </form>
  )
}
