import { registerDomain } from "@/registry/domain-registry";
import { registerArtifact } from "@/registry/artifact-registry";

registerDomain({
  id: "memory",
  label: "Memory",
  description: "Persistent procurement memory units — supplier knowledge stored per org.",
  iconName: "BrainCircuit",
  href: "/memory",
  navigationGroup: "cognition",
  artifactTypes: ["CognitionMemory"],
  supportedRenderers: ["memory"],
  primaryModel: "HydrationCognitionMemory",
  readiness: "ready",
  coverage: {
    hasData: true,
    hasRenderer: true,
    hasQuery: true,
    hasLineage: true,
    hasValidation: false,
  },
});

registerArtifact({
  artifactType: "CognitionMemory",
  domainId: "memory",
  sourceModel: "HydrationCognitionMemory",
  renderer: "memory",
  label: "Cognition Memory",
  description: "A persistent procurement memory unit per org.",
  supportedViews: ["table", "card"],
  isSearchable: true,
  hasEmbeddings: false,
  isCrossDomain: true,
  readiness: "ready",
  lineage: {
    producedBy: "H3",
    writer: "pcos-runtime",
    hasLineageEvents: true,
    isVersioned: true,
  },
});
