import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type EmbeddingsQueryResult = Awaited<ReturnType<typeof getEmbeddingsData>>;

export async function getEmbeddingsData() {
  const orgId = EXPLORER_ORG_ID;
  const [records, byDocType, byModel] = await Promise.all([
    prisma.hydrationEmbeddingRecord.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.hydrationEmbeddingRecord.groupBy({
      by: ["documentType"],
      where: { orgId, deletedAt: null },
      _count: { id: true },
      _avg: { tokenCount: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.hydrationEmbeddingRecord.groupBy({
      by: ["modelId"],
      where: { orgId, deletedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  const total = byDocType.reduce((sum: number, t) => sum + t._count.id, 0);
  const avgTokens =
    byDocType.reduce(
      (sum: number, t) => sum + (t._avg.tokenCount ?? 0) * t._count.id,
      0
    ) / (total || 1);
  const stdDim = records.filter((r) => r.dimensions === 1536).length;
  const nonStdDim = records.filter((r) => r.dimensions !== 1536).length;

  return { records, byDocType, byModel, total, avgTokens, stdDim, nonStdDim };
}
