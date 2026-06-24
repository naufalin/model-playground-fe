import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Model, ModelSelect } from '@/lib/api'
import { cn } from '@/lib/utils'

type Props = {
  models: Model[]
  selected: ModelSelect[]
  onChange: (selected: ModelSelect[]) => void
  disabled?: boolean
}

const REASONING_EFFORTS = ['low', 'medium', 'high'] as const

export function ModelSelector({ models, selected, onChange, disabled }: Props) {
  function toggleModel(model: Model) {
    const idx = selected.findIndex(
      (s) => s.provider === model.provider && s.model_name === model.model_name,
    )

    if (idx >= 0) {
      onChange(selected.filter((_, i) => i !== idx))
    } else {
      onChange([
        ...selected,
        {
          provider: model.provider,
          model_name: model.model_name,
          reasoning_effort: model.supports_reasoning ? 'medium' : null,
        },
      ])
    }
  }

  function setReasoningEffort(
    model: Model,
    effort: (typeof REASONING_EFFORTS)[number],
  ) {
    onChange(
      selected.map((s) =>
        s.provider === model.provider && s.model_name === model.model_name
          ? { ...s, reasoning_effort: effort }
          : s,
      ),
    )
  }

  function isSelected(model: Model) {
    return selected.some(
      (s) => s.provider === model.provider && s.model_name === model.model_name,
    )
  }

  function getSelected(model: Model) {
    return selected.find(
      (s) => s.provider === model.provider && s.model_name === model.model_name,
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        Select models to compare
      </p>
      <div className="flex flex-wrap gap-2">
        {models.map((model) => {
          const active = isSelected(model)
          const sel = getSelected(model)

          return (
            <div key={model.id} className="flex items-center gap-1">
              <Button
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                disabled={disabled}
                onClick={() => toggleModel(model)}
                className={cn(
                  'gap-1.5 rounded-xl',
                  active
                    ? 'bg-white/15 text-white border border-white/20 hover:bg-white/20'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
                )}
              >
                {model.display_name}
                {model.supports_reasoning && (
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-4 px-1 text-[10px] bg-[#E8FFF6] text-[#047857] ring-1 ring-[#B8F3DC]"
                  >
                    R
                  </Badge>
                )}
              </Button>
              {active && model.supports_reasoning && sel && (
                <select
                  className="h-7 rounded-lg border border-white/10 bg-white/8 px-1.5 text-xs font-medium text-white/60"
                  value={sel.reasoning_effort ?? 'medium'}
                  onChange={(e) =>
                    setReasoningEffort(
                      model,
                      e.target.value as (typeof REASONING_EFFORTS)[number],
                    )
                  }
                  disabled={disabled}
                >
                  {REASONING_EFFORTS.map((effort) => (
                    <option key={effort} value={effort}>
                      {effort}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
