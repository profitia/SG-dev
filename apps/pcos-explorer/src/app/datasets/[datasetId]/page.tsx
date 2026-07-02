export const dynamic = "force-dynamic";

import "@/registry/index";
import { DatasetPage } from "@/datasets/dataset-page";

export default async function DatasetRoutePage({
  params,
}: {
  params: Promise<{ datasetId: string }>;
}) {
  const { datasetId } = await params;
  return <DatasetPage datasetId={datasetId} />;
}