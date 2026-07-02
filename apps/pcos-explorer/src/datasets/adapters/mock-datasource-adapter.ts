import type {
  DatasetDefinition,
  DatasetQueryResult,
  DatasetRecord,
  DatasourceAdapter,
} from "@/datasets/dataset-contract";
import { registerDatasourceAdapter } from "@/datasets/dataset-registry";

const mockRecords = new Map<string, DatasetRecord[]>();

export function registerMockDatasetRecords(
  datasetId: string,
  records: DatasetRecord[]
): void {
  mockRecords.set(datasetId, records);
}

export const mockDatasourceAdapter: DatasourceAdapter = {
  id: "mock",
  kind: "mock",
  async load(dataset: DatasetDefinition): Promise<DatasetQueryResult> {
    const records = mockRecords.get(dataset.id) ?? [];

    return {
      dataset,
      records,
      fetchedAt: new Date().toISOString(),
      adapterLabel: dataset.datasource.label,
      adapterKind: "mock",
      isMock: true,
      note:
        dataset.datasource.note ??
        "Mock datasource adapter for dashboard framework bootstrapping.",
    };
  },
};

registerDatasourceAdapter(mockDatasourceAdapter);