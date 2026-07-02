import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DatasetSummaryCards } from "@/components/datasets/dataset-summary-cards";
import { DatasetTable } from "@/components/datasets/dataset-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { getDataset, loadDataset } from "@/datasets/dataset-registry";

export async function DatasetPage({ datasetId }: { datasetId: string }) {
  const dataset = getDataset(datasetId);

  if (!dataset) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="font-mono text-sm">
          Dataset not found: <strong>{datasetId}</strong>
        </p>
      </div>
    );
  }

  const result = await loadDataset(datasetId);
  const { view } = dataset;
  const placeholderFields = view.fields.filter((field) => field.isPlaceholder);

  return (
    <div className="min-h-full">
      <PageHeader
        title={view.title}
        description={view.description}
        action={
          <Link
            href="/datasets"
            className="inline-flex items-center rounded-full border border-border/80 bg-card px-3 py-2 text-sm font-medium text-[hsl(var(--pcos-accent))] transition-colors hover:bg-accent hover:text-foreground"
          >
            View all datasets
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 lg:px-8">
        <Card className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge variant="pcos">Dataset shell</Badge>
              <CardTitle className="mt-4 text-lg">Datasource abstraction bootstrap</CardTitle>
              <CardMeta className="mt-2 max-w-3xl text-sm leading-6">{dataset.description}</CardMeta>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">dataset: {dataset.id}</Badge>
              <Badge variant="muted">adapter: {result.adapterKind}</Badge>
              {view.isMock && <Badge variant="warning">mock data</Badge>}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-4 text-sm md:grid-cols-3 xl:grid-cols-1">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Datasource
              </p>
              <p className="mt-1 font-medium text-foreground">{view.dataSourceLabel}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Fetched At
              </p>
              <p className="mt-1 font-mono text-[12px] text-foreground">{result.fetchedAt}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Note
              </p>
              <p className="mt-1 text-foreground">{result.note ?? view.qualityNotice ?? "-"}</p>
            </div>
          </div>
        </Card>

        {(view.mockNotice || view.qualityNotice) && (
          <Card className="border-[hsl(var(--pcos-accent))/0.18] bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--accent))/0.28)]">
            <CardTitle className="text-base">Dataset notice</CardTitle>
            <div className="mt-3 space-y-3 text-sm leading-6 text-foreground">
              {view.mockNotice && <p>{view.mockNotice}</p>}
              {view.qualityNotice && (
                <p className="text-muted-foreground">{view.qualityNotice}</p>
              )}
            </div>
          </Card>
        )}

        <DatasetSummaryCards metrics={view.summaryMetrics} records={result.records} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
          <Card>
            <CardTitle className="text-base">Configured fields</CardTitle>
            <CardMeta className="mt-2">Field definitions and placeholder semantics exposed by the current dataset view config.</CardMeta>
            <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {view.fields.map((field) => (
              <div
                key={field.key}
                className="rounded-xl border border-border/80 bg-background/35 px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={field.isPlaceholder ? "warning" : "muted"}>
                    {field.label}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {field.key}
                  </span>
                </div>
                {(field.description || field.placeholderReason) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {field.placeholderReason ?? field.description}
                  </p>
                )}
              </div>
            ))}
            </div>
          </Card>

          <div className="space-y-6">
            {view.filters.length > 0 && (
              <Card>
                <CardTitle className="text-base">Configured filters</CardTitle>
                <CardMeta className="mt-2">Current view-config filters available for future interactive dataset controls.</CardMeta>
                <div className="mt-4 flex flex-wrap gap-2">
                  {view.filters.map((filter) => (
                    <Badge key={filter.id} variant="muted">
                      {filter.label}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {placeholderFields.length > 0 && (
              <Card>
                <CardTitle className="text-base">Placeholder fields</CardTitle>
                <CardMeta className="mt-2">
                  These fields are explicitly provisional and should not be treated as the final PostgreSQL or Snowflake contract.
                </CardMeta>
                <div className="mt-4 flex flex-wrap gap-2">
                  {placeholderFields.map((field) => (
                    <Badge key={field.key} variant="warning">
                      {field.label}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        <DatasetTable view={view} records={result.records} />
      </div>
    </div>
  );
}