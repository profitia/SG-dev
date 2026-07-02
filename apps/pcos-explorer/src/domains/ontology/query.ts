import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type OntologyQueryResult = Awaited<ReturnType<typeof getOntologyData>>;

export async function getOntologyData() {
  const orgId = EXPLORER_ORG_ID;
  const [nodes, byType] = await Promise.all([
    prisma.hydrationOntologyNode.findMany({
      where: { orgId, deletedAt: null },
      orderBy: [{ nodeType: "asc" }, { nodeKey: "asc" }],
      take: 200,
    }),
    prisma.hydrationOntologyNode.groupBy({
      by: ["nodeType"],
      where: { orgId, deletedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);
  return { nodes, byType };
}
