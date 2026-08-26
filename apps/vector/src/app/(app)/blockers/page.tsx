import { getBlockers } from "@/app/actions/tasks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TypeBadge } from "@/components/tasks/TaskBadges"
import { AlertOctagon } from "lucide-react"

export default async function BlockersPage() {
  let blockers: Awaited<ReturnType<typeof getBlockers>> = []
  let dbError = false

  try {
    blockers = await getBlockers()
  } catch {
    dbError = true
  }

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Blockers</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Issues blocking execution progress</p>
      </div>

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
            Active Blockers ({blockers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {blockers.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">
                No active blockers — execution is clear
              </p>
            ) : (
              blockers.map((blocker) => (
                <div key={blocker.id} className="rounded-md border border-red-900/40 bg-red-950/20 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-2.5">
                      <TypeBadge type={blocker.type} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{blocker.title}</p>
                        {blocker.project && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{blocker.project.name}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="blocked" className="shrink-0">{blocker.priority}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
