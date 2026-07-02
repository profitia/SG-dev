import type { RendererProps } from "@/registry/renderer-registry";
import type { SupplierQueryResult } from "@/domains/supplier/query";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBar } from "@/components/ui/confidence-bar";
import { StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import Link from "next/link";

export function SupplierRenderer({ data }: RendererProps) {
  const { ontologyNodes, memoryUnits, intelligenceUnits } = data as SupplierQueryResult;

  const supplierMap: Record<
    string,
    {
      key: string;
      ontologyNode?: (typeof ontologyNodes)[0];
      memory?: (typeof memoryUnits)[0];
      risk?: (typeof intelligenceUnits)[0];
    }
  > = {};

  for (const node of ontologyNodes) {
    if (!supplierMap[node.nodeKey]) supplierMap[node.nodeKey] = { key: node.nodeKey };
    supplierMap[node.nodeKey].ontologyNode = node;
  }
  for (const mem of memoryUnits) {
    if (!supplierMap[mem.subjectId]) supplierMap[mem.subjectId] = { key: mem.subjectId };
    supplierMap[mem.subjectId].memory = mem;
  }
  for (const intel of intelligenceUnits) {
    if (!supplierMap[intel.subjectId]) supplierMap[intel.subjectId] = { key: intel.subjectId };
    supplierMap[intel.subjectId].risk = intel;
  }

  const suppliers = Object.values(supplierMap);

  return (
    <div className="min-h-full">
      <PageHeader
        title="Supplier Cognition"
        description="Cross-domain view of what the system generated about suppliers — ontology nodes, memory units, and risk intelligence."
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Supplier Ontology Nodes"
            value={ontologyNodes.length.toLocaleString()}
            sub="nodeType = SUPPLIER"
          />
          <StatCard
            label="Supplier Memory Units"
            value={memoryUnits.length.toLocaleString()}
            sub="memoryType = SUPPLIER"
          />
          <StatCard
            label="Risk Intelligence Units"
            value={intelligenceUnits.length.toLocaleString()}
            sub="intelligenceType = SUPPLIER_RISK"
            accent
          />
        </div>

        {suppliers.length === 0 ? (
          <EmptyState
            title="No supplier cognition found"
            description="Run the PCOS-H3 pipeline to generate supplier cognition."
          />
        ) : (
          <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Supplier Key</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Ontology</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Memory</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Risk Intelligence</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Risk Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {suppliers.map((s) => (
                  <tr
                    key={s.key}
                    className="bg-[hsl(var(--card))] transition-colors hover:bg-[hsl(var(--accent))]"
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-[hsl(var(--foreground))]">{s.key}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.ontologyNode ? (
                        <Link
                          href={`/ontology/${s.ontologyNode.id}`}
                          className="text-[hsl(var(--primary))] hover:underline text-[11px]"
                        >
                          <Badge variant="default">node</Badge>
                        </Link>
                      ) : (
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.memory ? (
                        <div>
                          <Badge variant="muted">memory</Badge>
                          <span className="ml-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                            conf: {Math.round(s.memory.confidenceScore * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.risk ? (
                        <Badge variant="pcos">risk intel</Badge>
                      ) : (
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.risk ? (
                        <ConfidenceBar score={s.risk.confidenceScore} />
                      ) : (
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {suppliers.length >= 100 && (
              <div className="border-t border-[hsl(var(--border))] px-4 py-2 text-center">
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  Showing up to 100 suppliers per domain.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
