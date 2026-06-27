import { Check, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Tool } from '@/lib/api'
import { cn } from '@/lib/utils'

type Props = {
  tools: Tool[]
  selected: string[]
  onChange: (selected: string[]) => void
  disabled?: boolean
}

export function ToolSelector({ tools, selected, onChange, disabled }: Props) {
  const selectedSet = new Set(selected)
  const allSelected = tools.length > 0 && selected.length === tools.length

  function toggleTool(name: string) {
    if (selectedSet.has(name)) {
      onChange(selected.filter((tool) => tool !== name))
      return
    }
    onChange([...selected, name])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
          <Wrench className="size-3.5" />
          Tools
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || tools.length === 0 || allSelected}
            onClick={() => onChange(tools.map((tool) => tool.name))}
            className="h-7 rounded-lg px-2 text-xs text-white/55 hover:bg-white/10 hover:text-white"
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || selected.length === 0}
            onClick={() => onChange([])}
            className="h-7 rounded-lg px-2 text-xs text-white/55 hover:bg-white/10 hover:text-white"
          >
            None
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tools.map((tool) => {
          const active = selectedSet.has(tool.name)

          return (
            <button
              key={tool.name}
              type="button"
              disabled={disabled}
              onClick={() => toggleTool(tool.name)}
              title={tool.description}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition',
                active
                  ? 'border-emerald-300/35 bg-emerald-300/12 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {active && <Check className="size-3.5" />}
              {tool.name}
            </button>
          )
        })}
        {tools.length === 0 && (
          <p className="text-xs text-white/35">No runtime tools available.</p>
        )}
      </div>
    </div>
  )
}
