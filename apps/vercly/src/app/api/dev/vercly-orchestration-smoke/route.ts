import { NextResponse } from "next/server";

import { getVerclyReadiness } from "@/lib/vercly/config";

export const runtime = "nodejs";

export async function GET() {
  const readiness = getVerclyReadiness();

  return NextResponse.json({
    status: readiness.configured ? "configured" : "missing_config",
    provider: "vercly",
    orchestration: {
      startRoute: "/api/verifications",
      getRoute: "/api/verifications/{id}",
      pollRoute: "/api/verifications/{id}/poll",
      pollingMode: "single-step",
    },
    readiness,
  });
}