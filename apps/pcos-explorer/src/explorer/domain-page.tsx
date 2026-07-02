// PCOS Cognition Explorer — Domain Page (Dynamic View Engine)
// Server component that orchestrates: domain lookup → data fetch → renderer dispatch.
// Pages become thin wrappers: `<DomainPage domainId="ontology" />`

// Bootstrap all registries (idempotent — module cache prevents double-init)
import "@/registry/index";

import { getDomain } from "@/registry/domain-registry";
import { getArtifactsByDomain } from "@/registry/artifact-registry";
import { getRenderer } from "@/registry/renderer-registry";
import { executeDomainQuery } from "@/explorer/domain-engine";

interface DomainPageProps {
  domainId: string;
}

export async function DomainPage({ domainId }: DomainPageProps) {
  const domain = getDomain(domainId);
  if (!domain) {
    return (
      <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">
        <p className="font-mono text-sm">Domain not found: <strong>{domainId}</strong></p>
      </div>
    );
  }

  const artifacts = getArtifactsByDomain(domainId);

  const Renderer = getRenderer(domainId);
  if (!Renderer) {
    return (
      <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">
        <p className="font-mono text-sm">No renderer registered for domain: <strong>{domainId}</strong></p>
      </div>
    );
  }

  const data = await executeDomainQuery(domainId);

  return <Renderer domain={domain} artifacts={artifacts} data={data} />;
}
