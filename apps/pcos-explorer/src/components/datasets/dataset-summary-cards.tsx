import { StatCard } from "@/components/ui/card";
import type {
  DatasetMetricDefinition,
  DatasetRecord,
  DatasetValue,
} from "@/datasets/dataset-contract";

function isNumber(value: DatasetValue): value is number {
  return typeof value === "number";
}

function formatMetricValue(value: DatasetValue, format?: DatasetMetricDefinition["format"]): string {
  if (value == null) return "-";

  if (format === "currency" && typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (format === "date" && typeof value === "string") {
    return new Date(value).toLocaleString();
  }

  return String(value);
}

function computeMetric(metric: DatasetMetricDefinition, records: DatasetRecord[]): DatasetValue {
  const values = metric.valueKey
    ? records.map((record) => record[metric.valueKey!])
    : [];

  switch (metric.strategy) {
    case "count":
      return records.length;
    case "sum":
      return values.filter(isNumber).reduce((sum, value) => sum + value, 0);
    case "distinct":
      return new Set(values.filter((value) => value != null)).size;
    case "latest": {
      const strings = values.filter((value): value is string => typeof value === "string");
      return strings.sort().at(-1) ?? null;
    }
    default:
      return null;
  }
}

export function DatasetSummaryCards({
  metrics,
  records,
}: {
  metrics: DatasetMetricDefinition[];
  records: DatasetRecord[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <StatCard
          key={metric.id}
          label={metric.label}
          value={formatMetricValue(computeMetric(metric, records), metric.format)}
          sub={metric.description}
          accent={metric.id === "totalValue"}
        />
      ))}
    </div>
  );
}