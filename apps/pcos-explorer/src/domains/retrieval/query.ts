import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type RetrievalQueryResult = Awaited<ReturnType<typeof getRetrievalData>>;

export async function getRetrievalData() {
  const orgId = EXPLORER_ORG_ID;
  const [docs, byType] = await Promise.all([
    prisma.hydrationRetrievalDocument.findMany({
      where: { orgId, deletedAt: null },
      orderBy: [{ indexType: "asc" }, { documentType: "asc" }],
      take: 200,
      select: {
        id: true,
        orgId: true,
        hydrationRunId: true,
        indexType: true,
        documentId: true,
        documentType: true,
        searchableTokens: true,
        embeddingRef: true,
        createdAt: true,
      },
    }),
    prisma.hydrationRetrievalDocument.groupBy({
      by: ["indexType"],
      where: { orgId, deletedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);
  const withEmbedding = await prisma.hydrationRetrievalDocument.count({
    where: { orgId, deletedAt: null, embeddingRef: { not: null } },
  });
  return { docs, byType, withEmbedding };
}
