import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] ring-[hsl(var(--primary)/0.2)]",
        secondary:
          "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] ring-[hsl(var(--border))]",
        outline:
          "bg-transparent text-[hsl(var(--foreground))] ring-[hsl(var(--border))]",
        destructive:
          "bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))] ring-[hsl(var(--destructive)/0.2)]",
        // Status variants
        planned:
          "bg-slate-800/60 text-slate-400 ring-slate-700/50",
        active:
          "bg-blue-950/60 text-blue-400 ring-blue-800/50",
        blocked:
          "bg-red-950/60 text-red-400 ring-red-800/50",
        review:
          "bg-amber-950/60 text-amber-400 ring-amber-800/50",
        done:
          "bg-emerald-950/60 text-emerald-400 ring-emerald-800/50",
        archived:
          "bg-slate-900/60 text-slate-600 ring-slate-800/50",
        // Type variants
        task:
          "bg-slate-800/60 text-slate-400 ring-slate-700/50",
        blocker:
          "bg-red-950/60 text-red-400 ring-red-800/50",
        idea:
          "bg-violet-950/60 text-violet-400 ring-violet-800/50",
        decision:
          "bg-amber-950/60 text-amber-400 ring-amber-800/50",
        bug:
          "bg-orange-950/60 text-orange-400 ring-orange-800/50",
        note:
          "bg-slate-800/60 text-slate-500 ring-slate-700/50",
        refactor:
          "bg-cyan-950/60 text-cyan-400 ring-cyan-800/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
