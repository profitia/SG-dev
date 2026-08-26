import { getProtocolOverview } from "@/app/actions/protocol"
import { cn } from "@/lib/utils"
import {
  Shield,
  Radio,
  FileText,
  Boxes,
  Network,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Database,
  BookOpen,
} from "lucide-react"
import { EVENT_CATEGORIES } from "@/lib/protocol/events/taxonomy"
import type { EventCategory } from "@/lib/protocol/schemas/event.schema"
import { triggerRuntimeExport, seedTemplates } from "@/app/actions/protocol"

// ── Category color/icon map ───────────────────────────────────────────────────

const CATEGORY_META: Record<
  EventCategory,
  { label: string; color: string; bg: string }
> = {
  PLANNING: { label: "Planning", color: "text-blue-400", bg: "bg-blue-400/10" },
  EXECUTION: { label: "Execution", color: "text-green-400", bg: "bg-green-400/10" },
  COGNITION: { label: "Cognition", color: "text-purple-400", bg: "bg-purple-400/10" },
  AI: { label: "AI", color: "text-amber-400", bg: "bg-amber-400/10" },
  TOPOLOGY: { label: "Topology", color: "text-cyan-400", bg: "bg-cyan-400/10" },
  GOVERNANCE: { label: "Governance", color: "text-rose-400", bg: "bg-rose-400/10" },
}

const EXPORT_STATUS_META = {
  PENDING: { label: "Pending", icon: Clock, color: "text-amber-400" },
  INGESTED: { label: "Ingested", icon: CheckCircle2, color: "text-green-400" },
  CONFLICT: { label: "Conflict", icon: AlertTriangle, color: "text-orange-400" },
  STALE: { label: "Stale", icon: Clock, color: "text-[hsl(var(--muted-foreground))]" },
  REJECTED: { label: "Rejected", icon: XCircle, color: "text-red-400" },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProtocolPage() {
  const data = await getProtocolOverview()

  const totalEvents = data.eventCounts.reduce((s: number, e: { count: number }) => s + e.count, 0)
  const totalExports = data.exportStats.reduce((s: number, e: { count: number }) => s + e.count, 0)
  const ingestedExports = data.exportStats.find((e: { status: string; count: number }) => e.status === "INGESTED")?.count ?? 0

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto space-y-10">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Shield className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Execution Protocol
          </h1>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-2xl">
          Shared operational language · runtime export contract · event taxonomy · prompt protocol · orchestration bridge
        </p>
      </div>

      {/* Protocol overview stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Event Types",
            value: data.taxonomy.length,
            sub: "across 6 categories",
            icon: Radio,
          },
          {
            label: "Events Logged",
            value: totalEvents,
            sub: "execution events",
            icon: Zap,
          },
          {
            label: "Runtime Exports",
            value: totalExports,
            sub: `${ingestedExports} ingested`,
            icon: Database,
          },
          {
            label: "Prompt Templates",
            value: data.builtInTemplates.length,
            sub: "built-in archetypes",
            icon: FileText,
          },
        ].map(({ label, value, sub, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                {label}
              </span>
            </div>
            <div className="text-2xl font-bold text-[hsl(var(--foreground))] mb-0.5">
              {value}
            </div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column main content */}
      <div className="grid grid-cols-[1fr_380px] gap-6">

        {/* LEFT: Event Taxonomy + Prompt Protocol */}
        <div className="space-y-6">

          {/* Event Taxonomy */}
          <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Event Taxonomy
              </h2>
              <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
                {data.taxonomy.length} event types
              </span>
            </div>

            <div className="space-y-4">
              {EVENT_CATEGORIES.map((category) => {
                const meta = CATEGORY_META[category]
                const events = data.taxonomyByCategory[category] ?? []
                const count = data.eventCounts.find((e: { category: string; count: number }) => e.category === category)?.count ?? 0
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={cn(
                          "text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded",
                          meta.color,
                          meta.bg
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {events.length} types · {count} logged
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {events.map((event) => (
                        <div
                          key={event.type}
                          className="rounded px-2.5 py-1.5 bg-[hsl(var(--muted))/0.4] border border-[hsl(var(--border))]"
                        >
                          <div className="text-[10px] font-medium text-[hsl(var(--foreground))] mb-0.5">
                            {event.label}
                          </div>
                          <div className="text-[9px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                            {event.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Prompt Protocol */}
          <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Execution Prompt Protocol
              </h2>
            </div>

            {/* Schema example */}
            <div className="rounded-md bg-[hsl(var(--muted))] border border-[hsl(var(--border))] p-4 mb-4 font-mono text-[10px] leading-relaxed text-[hsl(var(--foreground))]">
              <div className="text-amber-400 font-semibold mb-2">[EXECUTION]</div>
              {[
                ["PROJECT:", "VECTOR"],
                ["WORKSPACE:", "Profitia"],
                ["ETAP:", "ETAP-07.5"],
                ["TYPE:", "implementation"],
                ["DOMAIN:", "protocol-runtime"],
                ["GOAL:", "Build shared execution protocol layer"],
                ["INPUTS:", "schema definitions, event taxonomy"],
                ["OUTPUTS:", "runtime exports, ingested state"],
                ["DEPENDENCIES:", "ETAP-07 workspace system"],
                ["SUCCESS_CRITERIA:", "0 TS errors, clean build"],
                ["RUNTIME_RULES:", "deterministic · explicit · observable"],
              ].map(([key, val]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-[hsl(var(--muted-foreground))] w-36 shrink-0">{key}</span>
                  <span className="text-[hsl(var(--foreground))]">{val}</span>
                </div>
              ))}
            </div>

            {/* Templates */}
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">
              Built-in Templates
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {data.builtInTemplates.map((t) => (
                <div
                  key={t.name}
                  className="rounded px-2.5 py-1.5 bg-[hsl(var(--muted))/0.4] border border-[hsl(var(--border))]"
                >
                  <div className="text-[10px] font-medium text-[hsl(var(--foreground))] mb-0.5 capitalize">
                    {t.name.replace(/-/g, " ")}
                  </div>
                  <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
                    {t.description}
                  </div>
                </div>
              ))}
            </div>

            {/* Seed action */}
            <form action={seedTemplates} className="mt-4">
              <button
                type="submit"
                className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors underline underline-offset-2"
              >
                Seed templates to database
              </button>
            </form>
          </section>
        </div>

        {/* RIGHT: Runtime exports + identity map + recent events */}
        <div className="space-y-4">

          {/* Runtime Export Control */}
          <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Runtime Exports
              </h2>
            </div>

            {/* Export stats */}
            <div className="flex gap-2 mb-3">
              {data.exportStats.map((stat: { status: string; count: number }) => {
                const meta = EXPORT_STATUS_META[stat.status as keyof typeof EXPORT_STATUS_META]
                const Icon = meta?.icon ?? Clock
                return (
                  <div
                    key={stat.status}
                    className="flex items-center gap-1 text-[10px]"
                  >
                    <Icon className={cn("h-3 w-3", meta?.color)} />
                    <span className={cn("font-medium", meta?.color)}>{stat.count}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{meta?.label}</span>
                  </div>
                )
              })}
              {data.exportStats.length === 0 && (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  No exports yet
                </span>
              )}
            </div>

            {/* Trigger export */}
            <form action={triggerRuntimeExport}>
              <button
                type="submit"
                className="w-full rounded-md border border-[hsl(var(--border))] px-3 py-2 text-[10px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--muted-foreground))/0.4] transition-colors text-left"
              >
                Export global runtime snapshot →
              </button>
            </form>

            {/* Recent exports */}
            {data.exportStats.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {data.exportStats.slice(0, 5).map((stat: { status: string; count: number }) => {
                  const meta = EXPORT_STATUS_META[stat.status as keyof typeof EXPORT_STATUS_META]
                  const Icon = meta?.icon ?? Clock
                  return (
                    <div
                      key={stat.status}
                      className="flex items-center justify-between text-[10px] py-1 border-b border-[hsl(var(--border))] last:border-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={cn("h-2.5 w-2.5", meta?.color)} />
                        <span className="text-[hsl(var(--foreground))]">{meta?.label}</span>
                      </div>
                      <span className="text-[hsl(var(--muted-foreground))] font-medium">
                        {stat.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Workspace Identity Map */}
          <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Boxes className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Workspace Identity Map
              </h2>
            </div>

            {data.identityMap.length === 0 ? (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                No workspaces defined yet.
              </p>
            ) : (
              <div className="space-y-2">
                {data.identityMap.map((ws: {
                    id: string
                    slug: string
                    name: string
                    archetype: string
                    projectCount: number
                    activeProjectCount: number
                    protocolVersion: string
                    runtimeVersion: string
                    conventionCount: number
                    hasProtocol: boolean
                  }) => (
                  <div
                    key={ws.id}
                    className="rounded px-3 py-2 bg-[hsl(var(--muted))/0.4] border border-[hsl(var(--border))]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-[hsl(var(--foreground))]">
                        {ws.name}
                      </span>
                      <span className="text-[9px] bg-[hsl(var(--muted))] rounded px-1.5 text-[hsl(var(--muted-foreground))]">
                        {ws.archetype}
                      </span>
                      {ws.hasProtocol && (
                        <CheckCircle2 className="h-2.5 w-2.5 text-green-400 ml-auto" />
                      )}
                    </div>
                    <div className="flex gap-3 text-[9px] text-[hsl(var(--muted-foreground))]">
                      <span>{ws.activeProjectCount}/{ws.projectCount} active</span>
                      <span>{ws.conventionCount} conventions</span>
                      <span>v{ws.protocolVersion}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Events */}
          <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Recent Events
              </h2>
              <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
                {totalEvents} total
              </span>
            </div>

            {data.recentEvents.length === 0 ? (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                No events logged yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.recentEvents.slice(0, 10).map((event: {
                    id: string
                    category: string
                    type: string
                    source: string
                    createdAt: Date
                    workspaceId?: string | null
                    projectId?: string | null
                  }) => {
                  const meta = CATEGORY_META[event.category as EventCategory]
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 text-[10px] py-1 border-b border-[hsl(var(--border))] last:border-0"
                    >
                      <span
                        className={cn(
                          "shrink-0 text-[8px] font-semibold px-1 py-0.5 rounded mt-0.5",
                          meta?.color,
                          meta?.bg
                        )}
                      >
                        {meta?.label ?? event.category}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[hsl(var(--foreground))] font-medium truncate">
                          {event.type.replace(/_/g, " ")}
                        </div>
                        <div className="text-[hsl(var(--muted-foreground))]">
                          {new Date(event.createdAt).toLocaleTimeString()}
                          {event.source !== "vector" && ` · ${event.source}`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Runtime Rules */}
          <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Execution Runtime Rules
              </h2>
            </div>
            <div className="space-y-1.5">
              {[
                "VECTOR only consumes structured runtime exports",
                "No git integration · no repository scanning",
                "No autonomous AI execution mutations",
                "No hidden execution state",
                "All state changes are human-reviewable",
                "Everything is explicit, deterministic, observable",
              ].map((rule) => (
                <div key={rule} className="flex items-start gap-2 text-[10px]">
                  <ChevronRight className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))] mt-0.5 shrink-0" />
                  <span className="text-[hsl(var(--muted-foreground))]">{rule}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
