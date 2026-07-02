import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type ValidationQueryResult = Awaited<ReturnType<typeof getValidationData>>;

export async function getValidationData() {
  const orgId = EXPLORER_ORG_ID;
  const runs = await prisma.cognitionValidationRun.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      qualityScores: true,
      maturityScore: true,
      promotionEvaluation: true,
    },
  });
  return { runs };
}
