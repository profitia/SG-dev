import { NewWorkspaceForm } from "@/components/workspaces/NewWorkspaceForm"
import { Building2 } from "lucide-react"
import Link from "next/link"

export default function NewWorkspacePage() {
  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-1">
          <Building2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            New Workspace
          </h1>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Select an archetype — VECTOR generates the full execution structure instantly.{" "}
          <Link href="/templates" className="underline underline-offset-2 hover:text-[hsl(var(--foreground))] transition-colors">
            Browse archetypes
          </Link>
        </p>
      </div>

      <NewWorkspaceForm />
    </div>
  )
}
