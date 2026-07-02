import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import type {
  DatasetFieldDefinition,
  DatasetRecord,
  DatasetTableColumnDefinition,
  DatasetValue,
  DatasetViewConfig,
} from "@/datasets/dataset-contract";

function formatCellValue(value: DatasetValue, format?: DatasetTableColumnDefinition["format"]): string {
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
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function isStatusField(column: DatasetTableColumnDefinition, field?: DatasetFieldDefinition): boolean {
  return column.format === "status" || field?.type === "status" || column.key.endsWith("Status");
}

function getAlignClass(align?: DatasetTableColumnDefinition["align"]): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function renderCell(
  column: DatasetTableColumnDefinition,
  row: DatasetRecord,
  field?: DatasetFieldDefinition
) {
  const value = row[column.key];
  if (isStatusField(column, field) && typeof value === "string") {
    return <Badge variant="muted">{value}</Badge>;
  }

  const text = formatCellValue(value, column.format);

  if (column.isPrimary) {
    return <span className="font-medium text-foreground">{text}</span>;
  }

  return text;
}

export function DatasetTable({
  view,
  records,
}: {
  view: DatasetViewConfig;
  records: DatasetRecord[];
}) {
  const fieldMap = new Map(view.fields.map((field) => [field.key, field]));

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b border-border/80 px-5 py-4">
        <div>
          <CardTitle className="text-base">Dataset rows</CardTitle>
          <CardMeta>
            {records.length.toLocaleString()} rows . Primary key: {view.primaryKey}
          </CardMeta>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        {records.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{view.emptyState.title}</p>
            <p className="mt-1">{view.emptyState.description}</p>
          </div>
        ) : (
        <table className="min-w-full divide-y divide-border/80 text-sm">
          <thead className="bg-secondary/40">
            <tr>
              {view.tableColumns.map((column) => (
                <th
                  key={column.key}
                  className={`px-5 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground ${getAlignClass(column.align)}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {records.map((row, index) => (
              <tr key={`${row[view.primaryKey] ?? "row"}-${index}`} className="transition-colors hover:bg-accent/25">
                {view.tableColumns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-5 py-3.5 align-top text-foreground ${getAlignClass(column.align)}`}
                  >
                    {renderCell(column, row, fieldMap.get(column.key))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </Card>
  );
}