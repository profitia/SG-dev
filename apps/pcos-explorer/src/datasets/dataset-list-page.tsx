import { PageHeader } from "@/components/ui/page-header";
import { DatasetCard } from "@/components/datasets/dataset-card";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllDatasets } from "@/datasets/dataset-registry";

export function DatasetListPage() {
  const datasets = getAllDatasets();

  return (
    <div className="min-h-full">
      <PageHeader
        title="Datasets"
        description="Registry-driven dataset selector for the Explorer shell. Mock datasets remain placeholder read models until a future PostgreSQL-backed contract exists."
      />

      <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 lg:px-8">
        <Card className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <Badge variant="pcos">Explorer shell</Badge>
            <CardTitle className="mt-4 text-lg">Dataset selector preview</CardTitle>
            <CardMeta className="mt-2 max-w-3xl text-sm leading-6">
              This view confirms the shared dataset dashboard shell is registry-driven, mock-first and ready for additional read-model contracts without binding to Snowflake or live PostgreSQL endpoints yet.
            </CardMeta>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Available datasets</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{datasets.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Source mode</p>
              <p className="mt-2 text-sm text-foreground">Mock datasource adapters only</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Current purpose</p>
              <p className="mt-2 text-sm text-foreground">UX shell and view-config validation</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
          {datasets.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </div>
      </div>
    </div>
  );
}