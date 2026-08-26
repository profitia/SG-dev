"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { createProject } from "@/app/actions/projects"
import { Plus, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 50)
}

export function CreateProjectForm() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 50)
  }, [open])

  function handleNameChange(val: string) {
    setName(val)
    if (!slugEdited) {
      setSlug(generateSlug(val))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || isPending) return
    setError(null)

    startTransition(async () => {
      const result = await createProject({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      })

      if ("error" in result && result.error) {
        const errs = result.error as Record<string, string[]>
        setError(
          Object.values(errs).flat()[0] ?? "Something went wrong"
        )
        return
      }

      setOpen(false)
      setName("")
      setSlug("")
      setDescription("")
      setSlugEdited(false)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
      >
        <Plus className="h-4 w-4" />
        New Project
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
          New Project
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={nameRef}
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        placeholder="Project name"
        className="w-full bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))] pb-1.5 outline-none focus:border-[hsl(var(--primary))] transition-colors"
      />

      <div className="flex items-center gap-2">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">/</span>
        <input
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugEdited(true) }}
          placeholder="slug"
          className="flex-1 bg-transparent text-xs font-mono text-[hsl(var(--muted-foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.5)] outline-none focus:text-[hsl(var(--foreground))]"
        />
      </div>

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
      />

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || !slug.trim() || isPending}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Create
        </button>
      </div>
    </form>
  )
}
