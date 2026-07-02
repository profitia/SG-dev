import { registerDomain } from "@/registry/domain-registry";
import { registerArtifact } from "@/registry/artifact-registry";

registerDomain({
  id: "hydration",
  label: "Hydration",
  description: "H3 hydration pipeline runs — lifecycle parent for all cognition substrate operations.",
  iconName: "GitBranch",
  href: "/hydration",
  navigationGroup: "lifecycle",
  artifactTypes: ["HydrationRun", "HydrationLineageEvent", "HydrationIngestBatch"],
  supportedRenderers: ["hydration"],
  primaryModel: "HydrationRun",
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
  artifactType: "HydrationRun",
  domainId: "hydration",
  sourceModel: "HydrationRun",
  renderer: "hydration",
  label: "Hydration Run",
  description: "A single H3 hydration pipeline execution.",
  supportedViews: ["table", "timeline"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H3",
    writer: "pcos-runtime",
    hasLineageEvents: true,
    isVersioned: false,
  },
});

registerArtifact({
  artifactType: "HydrationLineageEvent",
  domainId: "hydration",
  sourceModel: "HydrationLineageEvent",
  renderer: "hydration",
  label: "Lineage Event",
  description: "An immutable audit event for a hydration stage operation.",
  supportedViews: ["table", "timeline"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H3",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: false,
  },
});

registerArtifact({
  artifactType: "HydrationIngestBatch",
  domainId: "hydration",
  sourceModel: "HydrationIngestBatch",
  renderer: "hydration",
  label: "Ingest Batch",
  description: "A paginated Snowflake fetch batch within a hydration run.",
  supportedViews: ["table"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H3",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: true,
  },
});
