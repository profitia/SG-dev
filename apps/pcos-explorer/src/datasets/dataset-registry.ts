import type {
  DatasetDefinition,
  DatasetQueryResult,
  DatasourceAdapter,
} from "@/datasets/dataset-contract";

const datasets = new Map<string, DatasetDefinition>();
const adapters = new Map<string, DatasourceAdapter>();

export function registerDataset(dataset: DatasetDefinition): void {
  if (datasets.has(dataset.id)) {
    throw new Error(`[DatasetRegistry] Dataset already registered: ${dataset.id}`);
  }
  datasets.set(dataset.id, dataset);
}

export function registerDatasourceAdapter(adapter: DatasourceAdapter): void {
  if (adapters.has(adapter.id)) {
    throw new Error(`[DatasetRegistry] Adapter already registered: ${adapter.id}`);
  }
  adapters.set(adapter.id, adapter);
}

export function getDataset(datasetId: string): DatasetDefinition | undefined {
  return datasets.get(datasetId);
}

export function getAllDatasets(): DatasetDefinition[] {
  return Array.from(datasets.values());
}

export function getDatasourceAdapter(adapterId: string): DatasourceAdapter | undefined {
  return adapters.get(adapterId);
}

export async function loadDataset(datasetId: string): Promise<DatasetQueryResult> {
  const dataset = getDataset(datasetId);
  if (!dataset) {
    throw new Error(`[DatasetRegistry] Dataset not found: ${datasetId}`);
  }

  const adapter = getDatasourceAdapter(dataset.datasource.adapterId);
  if (!adapter) {
    throw new Error(
      `[DatasetRegistry] Datasource adapter not found: ${dataset.datasource.adapterId}`
    );
  }

  return adapter.load(dataset);
}