import { registerDomain } from "@/registry/domain-registry";
import { registerArtifact } from "@/registry/artifact-registry";

registerDomain({
  id: "intelligence",
  label: "Intelligence",
  description: "Baseline procurement intelligence units — risk, benchmark, and supplier signals.",
  iconName: "Zap",
  href: "/intelligence",
  navigationGroup: "cognition",
  artifactTypes: ["IntelligenceUnit"],
  supportedRenderers: ["intelligence"],
  primaryModel: "HydrationIntelligenceUnit",
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
  artifactType: "IntelligenceUnit",
  domainId: "intelligence",
  sourceModel: "HydrationIntelligenceUnit",
  renderer: "intelligence",
  label: "Intelligence Unit",
  description: "A baseline procurement intelligence signal per subject.",
  supportedViews: ["table", "card"],
  isSearchable: false,
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
