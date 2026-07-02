// PCOS Cognition Explorer — Renderer Registry
// Maps domain IDs to React renderer components.
// Separates rendering logic from data fetching and routing.

import type { DomainDefinition } from "./domain-registry";
import type { ArtifactDefinition } from "./artifact-registry";

// ── Renderer contract ─────────────────────────────────────────────────────────

export interface RendererProps {
  domain: DomainDefinition;
  artifacts: ArtifactDefinition[];
  // Data shape is domain-specific; each renderer casts to its own type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

// Renderers can be sync or async (Next.js server components)
export type DomainRenderer = (
  props: RendererProps
) => React.ReactNode | Promise<React.ReactNode>;

// ── Registry store ────────────────────────────────────────────────────────────

const _renderers = new Map<string, DomainRenderer>();

export function registerRenderer(domainId: string, renderer: DomainRenderer): void {
  if (_renderers.has(domainId)) {
    throw new Error(`[RendererRegistry] Renderer already registered for domain: ${domainId}`);
  }
  _renderers.set(domainId, renderer);
}

export function getRenderer(domainId: string): DomainRenderer | undefined {
  return _renderers.get(domainId);
}

export function hasRenderer(domainId: string): boolean {
  return _renderers.has(domainId);
}
