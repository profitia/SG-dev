import { NextResponse } from "next/server";

import { startLocalVerification } from "@/features/verifications/server/orchestration";

export const runtime = "nodejs";

type StartVerificationRequestBody = {
  orgId?: string;
  requestedByUserId?: string;
  inputId?: string;
  inputName?: string;
  country?: string;
  selectedSectionsJson?: unknown;
};

function isValidStartPayload(body: StartVerificationRequestBody) {
  return Boolean(
    body.orgId &&
      body.requestedByUserId &&
      body.inputId &&
      body.inputName,
  );
}

function mapStartErrorStatus(code: string) {
  if (code === "VERCLY_CONFIG_ERROR") {
    return 503;
  }

  if (code === "VERCLY_AUTH_ERROR" || code === "VERCLY_REFRESH_ERROR") {
    return 502;
  }

  return 500;
}

export async function POST(request: Request) {
  const body = (await request.json()) as StartVerificationRequestBody;

  if (!isValidStartPayload(body)) {
    return NextResponse.json(
      {
        status: "invalid_request",
        message:
          "orgId, requestedByUserId, inputId and inputName are required.",
      },
      { status: 400 },
    );
  }

  const result = await startLocalVerification({
    orgId: body.orgId!,
    requestedByUserId: body.requestedByUserId!,
    inputId: body.inputId!,
    inputName: body.inputName!,
    country: body.country,
    selectedSectionsJson: body.selectedSectionsJson ?? [],
  });

  if (result.error) {
    return NextResponse.json(
      {
        ...result,
        requestStatus: "failed",
      },
      { status: mapStartErrorStatus(result.error.code) },
    );
  }

  return NextResponse.json(
    {
      ...result,
      requestStatus: "accepted",
    },
    { status: 202 },
  );
}