import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type HydrationQueryResult = Awaited<ReturnType<typeof getHydrationData>>;

export async function getHydrationData() {
  const orgId = EXPLORER_ORG_ID;
  const runs = await prisma.hydrationRun.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      _count: {
        select: {
          ontologyNodes: true,
          cognitionMemory: true,
          intelligenceUnits: true,
          retrievalDocuments: true,
          embeddingRecords: true,
          lineageEvents: true,
          ingestBatches: true,
        },
      },
    },
  });
  return { runs };
}
