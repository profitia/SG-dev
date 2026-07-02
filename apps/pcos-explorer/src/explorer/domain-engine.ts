// PCOS Cognition Explorer — Domain Engine
// Maps domain IDs to their data-fetching functions.
// This is the execution bridge between the Domain Registry and the database.
// All executions are instrumented via the Observability Service.

import { getOntologyData } from "@/domains/ontology/query";
import { getMemoryData } from "@/domains/memory/query";
import { getIntelligenceData } from "@/domains/intelligence/query";
import { getRetrievalData } from "@/domains/retrieval/query";
import { getEmbeddingsData } from "@/domains/embeddings/query";
import { getHydrationData } from "@/domains/hydration/query";
import { getValidationData } from "@/domains/validation/query";
import { getSupplierData } from "@/domains/supplier/query";
import { getBenchmarkData } from "@/domains/benchmark/query";
import { getPromotionData } from "@/domains/promotion/query";
import { withQueryMetrics } from "@/services/observability";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryFn = () => Promise<any>;

const _queryFns: Record<string, QueryFn> = {
  ontology: getOntologyData,
  memory: getMemoryData,
  intelligence: getIntelligenceData,
  retrieval: getRetrievalData,
  embeddings: getEmbeddingsData,
  hydration: getHydrationData,
  validation: getValidationData,
  supplier: getSupplierData,
  benchmark: getBenchmarkData,
  promotion: getPromotionData,
};

export async function executeDomainQuery(domainId: string): Promise<unknown> {
  const fn = _queryFns[domainId];
  if (!fn) {
    throw new Error(
      `[DomainEngine] No query function registered for domain: ${domainId}`
    );
  }
  return withQueryMetrics(domainId, fn);
}
