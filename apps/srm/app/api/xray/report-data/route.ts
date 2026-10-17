import { createRuntimeSrmReportHandler } from "../../../../src/server/report-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createRuntimeSrmReportHandler();
