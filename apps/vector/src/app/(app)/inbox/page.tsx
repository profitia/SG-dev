import { getInboxItems } from "@/app/actions/inbox"
import { InboxList } from "@/components/dashboard/InboxList"
import { Inbox } from "lucide-react"

export default async function InboxPage() {
  let items: Awaited<ReturnType<typeof getInboxItems>> = []
  let dbError = false

  try {
    items = await getInboxItems()
  } catch {
    dbError = true
  }

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            Inbox
          </h1>
          {items.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.15)] text-[10px] font-medium text-[hsl(var(--primary))]">
              {items.length}
            </span>
          )}
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Quick-captured items waiting to be sorted into projects
        </p>
      </div>

      {dbError ? (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-6 py-5">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Configure <code className="font-mono text-amber-400/80">DATABASE_URL</code> in{" "}
            <code className="font-mono text-amber-400/80">.env</code> and run{" "}
            <code className="font-mono text-amber-400/80">npx prisma migrate dev</code>
          </p>
        </div>
      ) : (
        <InboxList items={items} />
      )}
    </div>
  )
}
