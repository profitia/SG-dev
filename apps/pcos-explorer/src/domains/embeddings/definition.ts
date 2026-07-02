import { registerDomain } from "@/registry/domain-registry";
import { registerArtifact } from "@/registry/artifact-registry";

registerDomain({
  id: "embeddings",
  label: "Embeddings",
  description: "Vector embeddings persisted for retrieval documents — semantic search substrate.",
  iconName: "Sparkles",
  href: "/embeddings",
  navigationGroup: "cognition",
  artifactTypes: ["EmbeddingRecord"],
  supportedRenderers: ["embeddings"],
  primaryModel: "HydrationEmbeddingRecord",
  readiness: "ready",
  coverage: {
    hasData: true,
    hasRenderer: true,
    hasQuery: true,
    hasLineage: false,
    hasValidation: false,
  },
});

registerArtifact({
  artifactType: "EmbeddingRecord",
  domainId: "embeddings",
  sourceModel: "HydrationEmbeddingRecord",
  renderer: "embeddings",
  label: "Embedding Record",
  description: "A persisted vector embedding for a retrieval document.",
  supportedViews: ["table", "card"],
  isSearchable: false,
  hasEmbeddings: true,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H3",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: true,
  },
});
