// PCOS Cognition Explorer — Registry Initialization
// Single import point that bootstraps all registries.
// Import this in any server component that needs the registry.
//
// Module-level side effects register domains, artifacts, and renderers
// exactly once — Node.js module cache prevents duplicate registration.

// ── Domain + Artifact registrations ─────────────────────────────────────────
import "@/datasets/index";
import "@/domains/benchmark/definition";
import "@/domains/embeddings/definition";
import "@/domains/hydration/definition";
import "@/domains/intelligence/definition";
import "@/domains/memory/definition";
import "@/domains/ontology/definition";
import "@/domains/promotion/definition";
import "@/domains/retrieval/definition";
import "@/domains/supplier/definition";
import "@/domains/validation/definition";
// ── Renderer registrations ───────────────────────────────────────────────────
import { initializeRenderers } from "@/explorer/renderer-engine";
initializeRenderers();

// ── Re-exports for consumer convenience ─────────────────────────────────────
export { getDomain, getAllDomains, getDomainsByGroup, getReadyDomains } from "@/registry/domain-registry";
export { getArtifact, getArtifactsByDomain, getAllArtifacts, getReadyArtifacts } from "@/registry/artifact-registry";
export { getRenderer, hasRenderer } from "@/registry/renderer-registry";
export { getNavigationItems } from "@/registry/navigation-registry";
export {
  getAllDatasets,
  getDataset,
  getDatasourceAdapter,
  loadDataset,
} from "@/datasets/index";
export {
  getDomainHealth,
  getAllDomainHealthReport,
  getPlatformHealthSummary,
} from "@/registry/health-registry";
