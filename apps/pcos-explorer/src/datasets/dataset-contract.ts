export type DatasetValue = string | number | boolean | null;

export type DatasetRecord = Record<string, DatasetValue>;

export type DatasetFieldType =
  | "string"
  | "number"
  | "date"
  | "currency"
  | "status"
  | "count";

export type DatasetValueFormat = "number" | "currency" | "date" | "status";

export type DatasourceKind = "mock" | "prisma" | "api" | "postgres-read-model";

export interface DatasetFieldDefinition {
  key: string;
  label: string;
  type: DatasetFieldType;
  description?: string;
  placeholderReason?: string;
  isPlaceholder?: boolean;
}

export interface DatasetFilterDefinition {
  id: string;
  fieldKey: string;
  label: string;
  type: "select" | "search" | "date-range";
  options?: Array<{ label: string; value: string }>;
}

export interface DatasetMetricDefinition {
  id: string;
  label: string;
  valueKey?: string;
  strategy: "count" | "sum" | "distinct" | "latest";
  format?: DatasetValueFormat;
  description?: string;
}

export interface DatasetTableColumnDefinition {
  key: string;
  label: string;
  format?: DatasetValueFormat;
  align?: "left" | "center" | "right";
  isPrimary?: boolean;
  width?: string;
}

export interface DatasetChartDefinition {
  id: string;
  label: string;
  type: "bar" | "line" | "pie";
}

export interface DatasetViewConfig {
  datasetId: string;
  title: string;
  description: string;
  dataSourceLabel: string;
  isMock: boolean;
  fields: DatasetFieldDefinition[];
  primaryKey: string;
  filters: DatasetFilterDefinition[];
  summaryMetrics: DatasetMetricDefinition[];
  tableColumns: DatasetTableColumnDefinition[];
  emptyState: {
    title: string;
    description: string;
  };
  qualityNotice?: string;
  mockNotice?: string;
  chartDefinitions?: DatasetChartDefinition[];
}

export interface DatasetDatasourceDefinition {
  adapterId: string;
  kind: DatasourceKind;
  label: string;
  isMock: boolean;
  note?: string;
}

export interface DatasetDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  href: string;
  view: DatasetViewConfig;
  datasource: DatasetDatasourceDefinition;
}

export interface DatasetQueryResult {
  dataset: DatasetDefinition;
  records: DatasetRecord[];
  fetchedAt: string;
  adapterLabel: string;
  adapterKind: DatasourceKind;
  isMock: boolean;
  note?: string;
}

export interface DatasourceAdapter {
  id: string;
  kind: DatasourceKind;
  load(dataset: DatasetDefinition): Promise<DatasetQueryResult>;
}