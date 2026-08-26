"use client"

import { useState, useTransition } from "react"
import { deleteInboxItem, processInboxItem } from "@/app/actions/inbox"
import { TypeBadge } from "@/components/tasks/TaskBadges"
import { Trash2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { InboxItem } from "@/types"

interface InboxListProps {
  items: InboxItem[]
}

function InboxRow({ item }: { item: InboxItem }) {
  const [, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteInboxItem(item.id)
    })
  }

  return (
    <div className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-[hsl(var(--accent))] transition-colors">
      <TypeBadge type={item.type} />
      <p className="flex-1 text-sm text-[hsl(var(--foreground))] truncate">
        {item.interpretedTitle}
      </p>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleDelete}
          className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-950/30 transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
        {new Date(item.createdAt).toLocaleTimeString("pl-PL", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  )
}

export function InboxList({ items }: InboxListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] border-dashed px-6 py-12 text-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Inbox is clear
        </p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Use <kbd className="font-mono bg-[hsl(var(--secondary))] px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd> to capture quickly
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <InboxRow key={item.id} item={item} />
      ))}
    </div>
  )
}
