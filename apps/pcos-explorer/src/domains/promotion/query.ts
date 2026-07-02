import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type PromotionQueryResult = Awaited<ReturnType<typeof getPromotionData>>;

export async function getPromotionData() {
  const orgId = EXPLORER_ORG_ID;

  const [executions, snapshots, versions, recentLineage, recentTelemetry] =
    await Promise.all([
      prisma.promotionExecution.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.cognitionSnapshot.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.cognitionVersion.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.promotionLineageEvent.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.promotionTelemetryEvent.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

  return {
    executions,
    snapshots,
    versions,
    recentLineage,
    recentTelemetry,
  };
}
