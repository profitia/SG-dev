import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type SupplierQueryResult = Awaited<ReturnType<typeof getSupplierData>>;

export async function getSupplierData() {
  const orgId = EXPLORER_ORG_ID;
  const [ontologyNodes, memoryUnits, intelligenceUnits] = await Promise.all([
    prisma.hydrationOntologyNode.findMany({
      where: { orgId, nodeType: "SUPPLIER", deletedAt: null },
      orderBy: { nodeKey: "asc" },
      take: 100,
    }),
    prisma.hydrationCognitionMemory.findMany({
      where: { orgId, memoryType: "SUPPLIER", deletedAt: null },
      orderBy: { subjectId: "asc" },
      take: 100,
    }),
    prisma.hydrationIntelligenceUnit.findMany({
      where: { orgId, intelligenceType: "SUPPLIER_RISK", deletedAt: null },
      orderBy: { subjectId: "asc" },
      take: 100,
    }),
  ]);
  return { ontologyNodes, memoryUnits, intelligenceUnits };
}
