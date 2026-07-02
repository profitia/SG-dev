import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type MemoryQueryResult = Awaited<ReturnType<typeof getMemoryData>>;

export async function getMemoryData() {
  const orgId = EXPLORER_ORG_ID;
  const [units, byType] = await Promise.all([
    prisma.hydrationCognitionMemory.findMany({
      where: { orgId, deletedAt: null },
      orderBy: [{ memoryType: "asc" }, { subjectId: "asc" }],
      take: 200,
    }),
    prisma.hydrationCognitionMemory.groupBy({
      by: ["memoryType"],
      where: { orgId, deletedAt: null },
      _count: { id: true },
      _avg: { confidenceScore: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);
  return { units, byType };
}
