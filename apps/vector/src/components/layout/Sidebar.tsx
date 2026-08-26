"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  Zap,
  Archive,
  AlertOctagon,
  GitBranch,
  Inbox,
  ChevronRight,
  Layers,
  Sparkles,
  Brain,
  Network,
  Building2,
  LayoutTemplate,
  Shield,
  GitMerge,
  LayoutList,
  Milestone,
  PlayCircle,
  ClipboardCheck,
  Layers3,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: Inbox,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    label: "Focus",
    href: "/focus",
    icon: Zap,
  },
  {
    label: "Backlog",
    href: "/backlog",
    icon: Archive,
  },
  {
    label: "ETAPs",
    href: "/etaps",
    icon: Layers,
  },
  {
    label: "Blockers",
    href: "/blockers",
    icon: AlertOctagon,
  },
  {
    label: "Dependencies",
    href: "/dependencies",
    icon: GitBranch,
  },
  {
    label: "AI History",
    href: "/ai-history",
    icon: Sparkles,
  },
  {
    label: "Cognition",
    href: "/cognition",
    icon: Brain,
  },
  {
    label: "Topology",
    href: "/topology",
    icon: Network,
  },
  {
    label: "Streams",
    href: "/streams",
    icon: GitMerge,
  },
  {
    label: "Phases",
    href: "/phases",
    icon: LayoutList,
  },
  {
    label: "Critical Path",
    href: "/critical-path",
    icon: Milestone,
  },
  {
    label: "Exec Queue",
    href: "/execution-queue",
    icon: PlayCircle,
  },
  {
    label: "Task Readiness",
    href: "/task-readiness",
    icon: ClipboardCheck,
  },
  {
    label: "Waves",
    href: "/implementation-waves",
    icon: Layers3,
  },
  {
    label: "Workspaces",
    href: "/workspaces",
    icon: Building2,
  },
  {
    label: "Archetypes",
    href: "/templates",
    icon: LayoutTemplate,
  },
  {
    label: "Protocol",
    href: "/protocol",
    icon: Shield,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[hsl(var(--border))] px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[hsl(var(--primary))]">
            <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--primary-foreground))]" />
          </div>
          <span className="text-sm font-semibold tracking-widest text-[hsl(var(--foreground))] uppercase">
            Vector
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--border))] px-5 py-3">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Profitia · ETAP 01
        </p>
      </div>
    </aside>
  )
}
