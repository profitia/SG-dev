import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type IntelligenceQueryResult = Awaited<ReturnType<typeof getIntelligenceData>>;

export async function getIntelligenceData() {
  const orgId = EXPLORER_ORG_ID;
  const [units, byType] = await Promise.all([
    prisma.hydrationIntelligenceUnit.findMany({
      where: { orgId, deletedAt: null },
      orderBy: [{ intelligenceType: "asc" }, { subjectId: "asc" }],
      take: 200,
    }),
    prisma.hydrationIntelligenceUnit.groupBy({
      by: ["intelligenceType"],
      where: { orgId, deletedAt: null },
      _count: { id: true },
      _avg: { confidenceScore: true, dataQualityScore: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);
  return { units, byType };
}
