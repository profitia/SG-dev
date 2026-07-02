import type { DatasetDefinition, DatasetRecord } from "@/datasets/dataset-contract";
import { registerMockDatasetRecords } from "@/datasets/adapters/mock-datasource-adapter";
import { registerDataset } from "@/datasets/dataset-registry";

const records: DatasetRecord[] = [
  {
    syncId: "sync-001",
    sourceSystem: "mock_erp_placeholder",
    sourceScope: "supplier_master",
    lastSyncAt: "2026-06-30T08:15:00.000Z",
    lastSyncStatus: "mock_success",
    recordsIngested: 148,
    recordsNormalized: 132,
    issuesDetected: 2,
    owner: "Ops Platform",
  },
  {
    syncId: "sync-002",
    sourceSystem: "mock_csv_placeholder",
    sourceScope: "cost_components",
    lastSyncAt: "2026-06-30T09:45:00.000Z",
    lastSyncStatus: "mock_warning",
    recordsIngested: 91,
    recordsNormalized: 73,
    issuesDetected: 6,
    owner: "Commercial Finance",
  },
  {
    syncId: "sync-003",
    sourceSystem: "mock_api_placeholder",
    sourceScope: "market_benchmarks",
    lastSyncAt: "2026-06-29T17:40:00.000Z",
    lastSyncStatus: "mock_pending_review",
    recordsIngested: 34,
    recordsNormalized: 34,
    issuesDetected: 1,
    owner: "Data Operations",
  },
];

export const syncMetadataMockDataset: DatasetDefinition = {
  id: "sync_metadata_mock",
  slug: "sync-metadata-mock",
  title: "Sync Metadata",
  description:
    "Mock operational sync monitoring dataset validating that Explorer dataset selection and rendering are multi-dataset, not single-dataset.",
  href: "/datasets/sync_metadata_mock",
  datasource: {
    adapterId: "mock",
    kind: "mock",
    label: "Mock datasource adapter",
    isMock: true,
    note:
      "Frontend placeholder dataset only. No real ETL orchestration, PostgreSQL read model or Snowflake lineage should be inferred from this view.",
  },
  view: {
    datasetId: "sync_metadata_mock",
    title: "Sync Metadata",
    description:
      "Mock monitoring dataset showing sync freshness and issue density across placeholder source feeds.",
    dataSourceLabel: "Mock datasource adapter",
    isMock: true,
    primaryKey: "syncId",
    fields: [
      { key: "syncId", label: "Sync ID", type: "string" },
      {
        key: "sourceSystem",
        label: "Source System",
        type: "string",
        isPlaceholder: true,
        placeholderReason: "Final upstream system taxonomy is not fixed yet.",
      },
      {
        key: "sourceScope",
        label: "Source Scope",
        type: "string",
        isPlaceholder: true,
        placeholderReason: "Read-model grouping remains a frontend placeholder until a real contract exists.",
      },
      { key: "lastSyncAt", label: "Last Sync At", type: "date" },
      { key: "lastSyncStatus", label: "Last Sync Status", type: "status" },
      { key: "recordsIngested", label: "Records Ingested", type: "count" },
      { key: "recordsNormalized", label: "Records Normalized", type: "count" },
      { key: "issuesDetected", label: "Issues Detected", type: "count" },
      { key: "owner", label: "Owner", type: "string" },
    ],
    filters: [
      {
        id: "sourceSystem",
        fieldKey: "sourceSystem",
        label: "Source System",
        type: "select",
        options: [
          { label: "mock_erp_placeholder", value: "mock_erp_placeholder" },
          { label: "mock_csv_placeholder", value: "mock_csv_placeholder" },
          { label: "mock_api_placeholder", value: "mock_api_placeholder" },
        ],
      },
    ],
    summaryMetrics: [
      {
        id: "syncCount",
        label: "Sync Jobs",
        strategy: "count",
        format: "number",
        description: "Registered mock sync jobs in this placeholder dashboard slice.",
      },
      {
        id: "ingestedRecords",
        label: "Records Ingested",
        valueKey: "recordsIngested",
        strategy: "sum",
        format: "number",
      },
      {
        id: "issueCount",
        label: "Issues Detected",
        valueKey: "issuesDetected",
        strategy: "sum",
        format: "number",
      },
      {
        id: "latestSync",
        label: "Latest Sync",
        valueKey: "lastSyncAt",
        strategy: "latest",
        format: "date",
      },
    ],
    tableColumns: [
      { key: "syncId", label: "Sync ID", isPrimary: true },
      { key: "sourceSystem", label: "Source System" },
      { key: "sourceScope", label: "Scope" },
      { key: "recordsIngested", label: "Ingested", format: "number", align: "right" },
      { key: "recordsNormalized", label: "Normalized", format: "number", align: "right" },
      { key: "issuesDetected", label: "Issues", format: "number", align: "right" },
      { key: "lastSyncStatus", label: "Status", format: "status" },
      { key: "lastSyncAt", label: "Last Sync", format: "date" },
    ],
    emptyState: {
      title: "No sync metadata records",
      description: "The mock datasource returned no rows for this placeholder monitoring dataset.",
    },
    mockNotice:
      "This dataset is mock-only. It validates the shared dashboard shell and not a real sync telemetry contract.",
    qualityNotice:
      "Field naming, owners and issue semantics remain provisional until a future PostgreSQL read model exists.",
  },
};

registerMockDatasetRecords(syncMetadataMockDataset.id, records);
registerDataset(syncMetadataMockDataset);