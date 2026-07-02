// PCOS Cognition Explorer — Renderer Engine
// Registers all domain renderers and wires them to the Renderer Registry.
// Imported once by registry/index.ts — do not import directly in pages.

import { registerRenderer } from "@/registry/renderer-registry";
import { OntologyRenderer } from "@/renderers/ontology-renderer";
import { MemoryRenderer } from "@/renderers/memory-renderer";
import { IntelligenceRenderer } from "@/renderers/intelligence-renderer";
import { RetrievalRenderer } from "@/renderers/retrieval-renderer";
import { EmbeddingsRenderer } from "@/renderers/embeddings-renderer";
import { HydrationRenderer } from "@/renderers/hydration-renderer";
import { ValidationRenderer } from "@/renderers/validation-renderer";
import { SupplierRenderer } from "@/renderers/supplier-renderer";
import { BenchmarkRenderer } from "@/renderers/benchmark-renderer";
import { PromotionRenderer } from "@/renderers/promotion-renderer";

let _initialized = false;

export function initializeRenderers(): void {
  if (_initialized) return;
  _initialized = true;

  registerRenderer("ontology", OntologyRenderer);
  registerRenderer("memory", MemoryRenderer);
  registerRenderer("intelligence", IntelligenceRenderer);
  registerRenderer("retrieval", RetrievalRenderer);
  registerRenderer("embeddings", EmbeddingsRenderer);
  registerRenderer("hydration", HydrationRenderer);
  registerRenderer("validation", ValidationRenderer);
  registerRenderer("supplier", SupplierRenderer);
  registerRenderer("benchmark", BenchmarkRenderer);
  registerRenderer("promotion", PromotionRenderer);
}
