import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import type { DatasetDefinition } from "@/datasets/dataset-contract";

export function DatasetCard({ dataset }: { dataset: DatasetDefinition }) {
  return (
    <Link href={dataset.href} className="group block h-full">
      <Card className="flex h-full flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--pcos-accent))/0.5] hover:bg-accent/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{dataset.view.title}</CardTitle>
            <CardMeta className="mt-2 max-w-xl text-sm leading-6">{dataset.view.description}</CardMeta>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="muted">{dataset.datasource.kind}</Badge>
            {dataset.view.isMock && <Badge variant="warning">mock</Badge>}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Dataset
            </p>
            <p className="mt-1 font-mono text-[12px] text-foreground">{dataset.id}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Datasource
            </p>
            <p className="mt-1 text-foreground">{dataset.view.dataSourceLabel}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              View config
            </p>
            <p className="mt-1 text-foreground">
              {dataset.view.tableColumns.length} columns . {dataset.view.summaryMetrics.length} metrics
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border/70 pt-4 text-sm">
          <span className="text-muted-foreground">
            {dataset.view.isMock ? "Mock preview dataset" : "Dataset"}
          </span>
          <span className="font-medium text-[hsl(var(--pcos-accent))] transition-colors group-hover:text-foreground">
            Open dataset
          </span>
        </div>
      </Card>
    </Link>
  );
}