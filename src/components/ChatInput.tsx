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
        className="min-h-[40px] max-h-[200px] resize-none rounded-xl border-[#E3DACC] bg-[#FFFCF6] text-[#080B14] placeholder:text-[#9CA3AF] focus-visible:border-[#5EF2C1] focus-visible:ring-[#5EF2C1]/30"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !value.trim()}
        className="shrink-0 rounded-xl bg-[#080B14] text-white shadow-[0_6px_20px_rgba(8,11,20,0.15)] hover:bg-[#111827]"
      >
        <Send className="size-4" />
      </Button>
    </form>
  )
}
