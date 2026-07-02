import { registerDomain } from "@/registry/domain-registry";
import { registerArtifact } from "@/registry/artifact-registry";

registerDomain({
  id: "validation",
  label: "Validation",
  description: "H4 cognition validation — quality scores, maturity scores, promotion readiness.",
  iconName: "ShieldCheck",
  href: "/validation",
  navigationGroup: "lifecycle",
  artifactTypes: ["ValidationRun", "QualityScore", "MaturityScore", "PromotionEvaluation"],
  supportedRenderers: ["validation"],
  primaryModel: "CognitionValidationRun",
  readiness: "ready",
  coverage: {
    hasData: true,
    hasRenderer: true,
    hasQuery: true,
    hasLineage: false,
    hasValidation: true,
  },
});

registerArtifact({
  artifactType: "ValidationRun",
  domainId: "validation",
  sourceModel: "CognitionValidationRun",
  renderer: "validation",
  label: "Validation Run",
  description: "A single H4 cognition validation execution.",
  supportedViews: ["table", "detail"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H4",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: true,
  },
});

registerArtifact({
  artifactType: "QualityScore",
  domainId: "validation",
  sourceModel: "CognitionQualityScore",
  renderer: "validation",
  label: "Quality Score",
  description: "Per-dimension quality score for a validation run.",
  supportedViews: ["table", "card"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H4",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: false,
  },
});

registerArtifact({
  artifactType: "MaturityScore",
  domainId: "validation",
  sourceModel: "CognitionMaturityScore",
  renderer: "validation",
  label: "Maturity Score",
  description: "Weighted overall cognition maturity score (0–100).",
  supportedViews: ["card", "detail"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H4",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: false,
  },
});

registerArtifact({
  artifactType: "PromotionEvaluation",
  domainId: "validation",
  sourceModel: "PromotionReadinessEvaluation",
  renderer: "validation",
  label: "Promotion Evaluation",
  description: "Promotion gate evaluation — readiness score and blockers.",
  supportedViews: ["card", "detail"],
  isSearchable: false,
  hasEmbeddings: false,
  isCrossDomain: false,
  readiness: "ready",
  lineage: {
    producedBy: "H4",
    writer: "pcos-runtime",
    hasLineageEvents: false,
    isVersioned: false,
  },
});
