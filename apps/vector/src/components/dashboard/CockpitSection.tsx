import { cn } from "@/lib/utils"

interface SectionProps {
  label: string
  count?: number
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export function CockpitSection({ label, count, children, className, action }: SectionProps) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between pb-1 border-b border-[hsl(var(--border)/0.5)]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            {label}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.6)]">
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

interface EmptyProps {
  label: string
}

export function CockpitEmpty({ label }: EmptyProps) {
  return (
    <p className="text-xs text-[hsl(var(--muted-foreground)/0.5)] py-2 italic">
      {label}
    </p>
  )
}
