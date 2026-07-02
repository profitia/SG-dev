import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

export type BenchmarkQueryResult = Awaited<ReturnType<typeof getBenchmarkData>>;

export async function getBenchmarkData() {
  const orgId = EXPLORER_ORG_ID;
  const [
    ontologyNodes,
    benchmarkIntelligence,
    shouldCostIntelligence,
    forecastIntelligence,
    macroIntelligence,
  ] = await Promise.all([
    prisma.hydrationOntologyNode.findMany({
      where: { orgId, nodeType: "BENCHMARK", deletedAt: null },
      orderBy: { nodeKey: "asc" },
      take: 100,
    }),
    prisma.hydrationIntelligenceUnit.findMany({
      where: { orgId, intelligenceType: "BENCHMARK", deletedAt: null },
      orderBy: { subjectId: "asc" },
      take: 100,
    }),
    prisma.hydrationIntelligenceUnit.findMany({
      where: { orgId, intelligenceType: "SHOULD_COST", deletedAt: null },
      orderBy: { subjectId: "asc" },
      take: 50,
    }),
    prisma.hydrationIntelligenceUnit.findMany({
      where: { orgId, intelligenceType: "FORECASTING", deletedAt: null },
      orderBy: { subjectId: "asc" },
      take: 50,
    }),
    prisma.hydrationIntelligenceUnit.findMany({
      where: { orgId, intelligenceType: "MACROECONOMIC", deletedAt: null },
      orderBy: { subjectId: "asc" },
      take: 50,
    }),
  ]);
  return {
    ontologyNodes,
    benchmarkIntelligence,
    shouldCostIntelligence,
    forecastIntelligence,
    macroIntelligence,
  };
}
