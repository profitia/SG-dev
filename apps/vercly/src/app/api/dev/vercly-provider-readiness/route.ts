import { NextResponse } from "next/server";

import { getVerclyReadiness } from "@/lib/vercly/config";

export const runtime = "nodejs";

export async function GET() {
  const readiness = getVerclyReadiness();

  return NextResponse.json({
    status: readiness.configured ? "configured" : "missing_config",
    provider: "vercly",
    authFlow: {
      loginEndpoint: "/api/login",
      refreshEndpoint: "/api/tokens",
      authMode: "Basic Auth + Bearer access token + Bearer refresh token",
    },
    verificationFlow: {
      startEndpoint: "/api/verifications",
      reportEndpoint: "/api/verifications/{CorrelationId}",
      recommendedPollIntervalMs: readiness.pollIntervalMs,
      recommendedPollTimeoutMs: readiness.pollTimeoutMs,
      completionSignal: "Body.IsComplete === true",
    },
    readiness,
  });
}