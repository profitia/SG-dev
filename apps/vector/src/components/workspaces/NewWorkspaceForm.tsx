"use client"

import { useState } from "react"
import { createWorkspace } from "@/app/actions/workspaces"
import { ARCHETYPE_LIST, type WorkspaceArchetype } from "@/lib/workspaces/archetypes"
import { cn } from "@/lib/utils"
import { ChevronRight, GitFork, Layers } from "lucide-react"

// ── Archetype card ────────────────────────────────────────────────────────────

function ArchetypeCard({
  template,
  selected,
  onSelect,
}: {
  template: (typeof ARCHETYPE_LIST)[0]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left w-full rounded-lg border px-4 py-3.5 transition-all cursor-pointer",
        selected
          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.06]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--muted-foreground))/0.4]"
      )}
    >
      <div className="text-xs font-semibold text-[hsl(var(--foreground))] mb-0.5">
        {template.label}
      </div>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{template.tagline}</div>
    </button>
  )
}

// ── Archetype preview ─────────────────────────────────────────────────────────

function ArchetypePreview({ template }: { template: (typeof ARCHETYPE_LIST)[0] }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-5">
      <div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
          {template.description}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Projects */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Projects
            </span>
          </div>
          <div className="space-y-1.5">
            {template.projects.map((p) => (
              <div key={p.name}>
                <div className="text-xs font-medium text-[hsl(var(--foreground))]">{p.name}</div>
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  {p.etaps.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Execution Domains */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Layers className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Domains
            </span>
          </div>
          <div className="space-y-1.5">
            {template.executionDomains.map((d) => (
              <div key={d.name}>
                <div className="text-xs font-medium text-[hsl(var(--foreground))]">{d.name}</div>
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {d.projectNames.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Topology */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <GitFork className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Topology
            </span>
          </div>
          <div className="space-y-1.5">
            {template.topology.map((edge, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-[hsl(var(--foreground))]">
                  {edge.from}
                </span>
                <ChevronRight className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                  {edge.to}
                </span>
                <span
                  className={cn(
                    "ml-auto text-[9px] font-semibold shrink-0",
                    edge.criticality === "CRITICAL"
                      ? "text-red-400"
                      : edge.criticality === "HIGH"
                      ? "text-amber-400"
                      : "text-[hsl(var(--muted-foreground))]"
                  )}
                >
                  {edge.criticality}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conventions excerpt */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1.5">
          AI Conventions
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(template.conventions)
            .filter(([k]) => k.startsWith("ai."))
            .map(([k, v]) => (
              <span
                key={k}
                className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]"
              >
                {k.replace("ai.", "")}: <span className="text-[hsl(var(--foreground))]">{v}</span>
              </span>
            ))}
        </div>
      </div>
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function NewWorkspaceForm() {
  const [selectedArchetype, setSelectedArchetype] = useState<WorkspaceArchetype | null>(null)
  const [pending, setPending] = useState(false)

  const selectedTemplate = selectedArchetype
    ? ARCHETYPE_LIST.find((a) => a.archetype === selectedArchetype) ?? null
    : null

  async function handleSubmit(formData: FormData) {
    setPending(true)
    await createWorkspace(formData)
    // redirect happens server-side; pending stays true
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {/* Workspace name */}
      <div>
        <label className="block text-xs font-medium text-[hsl(var(--foreground))] mb-2">
          Workspace name
        </label>
        <input
          name="name"
          required
          placeholder="e.g. SpendGuru, Leaxaro, ACME Corp..."
          className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--primary))] transition-colors"
        />
      </div>

      {/* Archetype selection */}
      <div>
        <label className="block text-xs font-medium text-[hsl(var(--foreground))] mb-3">
          Archetype
        </label>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {ARCHETYPE_LIST.map((template) => (
            <ArchetypeCard
              key={template.archetype}
              template={template}
              selected={selectedArchetype === template.archetype}
              onSelect={() => setSelectedArchetype(template.archetype)}
            />
          ))}
        </div>

        {/* Live preview */}
        {selectedTemplate && <ArchetypePreview template={selectedTemplate} />}
      </div>

      {/* Hidden archetype value for server action */}
      <input type="hidden" name="archetype" value={selectedArchetype ?? ""} />

      {/* Optional description */}
      <div>
        <label className="block text-xs font-medium text-[hsl(var(--foreground))] mb-2">
          Description{" "}
          <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span>
        </label>
        <input
          name="description"
          placeholder="Brief context about this workspace..."
          className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--primary))] transition-colors"
        />
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={!selectedArchetype || pending}
          className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Generating workspace..." : "Generate Workspace"}
        </button>
        {!selectedArchetype && (
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            Select an archetype to continue
          </p>
        )}
      </div>
    </form>
  )
}
