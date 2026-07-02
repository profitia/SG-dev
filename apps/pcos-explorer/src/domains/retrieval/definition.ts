import { registerDomain } from "@/registry/domain-registry";
import { registerArtifact } from "@/registry/artifact-registry";

registerDomain({
  id: "retrieval",
  label: "Retrieval",
  description: "Indexed retrieval documents for CIC context lookup — procurement knowledge base.",
  iconName: "FileSearch",
  href: "/retrieval",
  navigationGroup: "cognition",
  artifactTypes: ["RetrievalDocument"],
  supportedRenderers: ["retrieval"],
  primaryModel: "HydrationRetrievalDocument",
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
  artifactType: "RetrievalDocument",
  domainId: "retrieval",
  sourceModel: "HydrationRetrievalDocument",
  renderer: "retrieval",
  label: "Retrieval Document",
  description: "An indexed procurement document for CIC context lookup.",
  supportedViews: ["table", "detail"],
  isSearchable: true,
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
