import { registerDomain } from "@/registry/domain-registry";

// NOTE: Supplier domain aggregates artifacts from ontology, memory, and intelligence.
// These artifact types are already registered by their primary domains.
// No duplicate registerArtifact calls here — cross-domain reference only.

registerDomain({
  id: "supplier",
  label: "Supplier Cognition",
  description: "Cross-domain view of supplier knowledge — ontology nodes, memory, and risk intelligence.",
  iconName: "Building2",
  href: "/supplier",
  navigationGroup: "cross-domain",
  artifactTypes: ["OntologyNode", "CognitionMemory", "IntelligenceUnit"],
  supportedRenderers: ["supplier"],
  primaryModel: "HydrationOntologyNode",
  readiness: "ready",
  coverage: {
    hasData: true,
    hasRenderer: true,
    hasQuery: true,
    hasLineage: true,
    hasValidation: false,
  },
});
