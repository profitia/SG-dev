import { registerDomain } from "@/registry/domain-registry";

// NOTE: Benchmark domain aggregates artifacts from ontology and intelligence.
// These artifact types are already registered by their primary domains.
// No duplicate registerArtifact calls here — cross-domain reference only.

registerDomain({
  id: "benchmark",
  label: "Benchmark Cognition",
  description: "Cross-domain view of benchmark knowledge — market benchmarks and supplier intelligence.",
  iconName: "BarChart3",
  href: "/benchmark",
  navigationGroup: "cross-domain",
  artifactTypes: ["OntologyNode", "IntelligenceUnit"],
  supportedRenderers: ["benchmark"],
  primaryModel: "HydrationOntologyNode",
  readiness: "ready",
  coverage: {
    hasData: true,
    hasRenderer: true,
    hasQuery: true,
    hasLineage: false,
    hasValidation: false,
  },
});
