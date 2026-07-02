import { registerDomain } from "@/registry/domain-registry";
import { registerArtifact } from "@/registry/artifact-registry";

registerDomain({
  id: "promotion",
  label: "Promotion",
  description:
    "H5 cognition promotion — LAB → PROD pipeline, snapshots, versioning, and full audit trail.",
  iconName: "Rocket",
  href: "/promotion",
  navigationGroup: "lifecycle",
  artifactTypes: [
    "PromotionExecution",
    "CognitionSnapshot",
    "CognitionVersion",
    "PromotionTelemetry",
    "PromotionLineage",
  ],
  supportedRenderers: ["promotion"],
  primaryModel: "PromotionExecution",
  readiness: "ready",
  coverage: {
    hasData: true,
    hasRenderer: true,
    hasQuery: true,
    hasLineage: true,
    hasValidation: true,
  },
});

registerArtifact({
  artifactType: "PromotionExecution",
  domainId: "promotion",
  sourceModel: "PromotionExecution",
  renderer: "promotion",
  label: "Promotion Execution",
  description: "A single H5 promotion pipeline execution (LAB → PROD).",
  supportedViews: ["table", "detail", "timeline"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H5",
    writer: "pcos-runtime",
    hasLineageEvents: true,
    isVersioned: true,
  },
});

registerArtifact({
  artifactType: "CognitionSnapshot",
  domainId: "promotion",
  sourceModel: "CognitionSnapshot",
  renderer: "promotion",
  label: "Cognition Snapshot",
  description:
    "Immutable, content-addressed snapshot of LAB cognition taken before promotion.",
  supportedViews: ["table", "detail"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H5",
    writer: "pcos-runtime",
    hasLineageEvents: true,
    isVersioned: false,
  },
});

registerArtifact({
  artifactType: "CognitionVersion",
  domainId: "promotion",
  sourceModel: "CognitionVersion",
  renderer: "promotion",
  label: "Cognition Version",
  description:
    "Semantic version assigned to each promoted cognition snapshot (MAJOR.MINOR.PATCH-env).",
  supportedViews: ["table", "detail"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H5",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: true,
  },
});

registerArtifact({
  artifactType: "PromotionTelemetry",
  domainId: "promotion",
  sourceModel: "PromotionTelemetryEvent",
  renderer: "promotion",
  label: "Promotion Telemetry",
  description: "Phase-level metric events for the H5 promotion pipeline.",
  supportedViews: ["table", "timeline"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H5",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: false,
  },
});

registerArtifact({
  artifactType: "PromotionLineage",
  domainId: "promotion",
  sourceModel: "PromotionLineageEvent",
  renderer: "promotion",
  label: "Promotion Lineage Events",
  description: "Full audit trail of H5 promotion phase events.",
  supportedViews: ["table", "timeline"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H5",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: false,
  },
});
