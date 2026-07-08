import { CompanyVerificationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  appendCompanyVerificationPayload,
  createCompanyVerification,
  getCompanyVerificationById,
  markCompanyVerificationStatus,
} from "@/features/verifications/server/repository";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ready",
    route: "/api/dev/persistence-smoke",
    method: "POST",
    purpose: "Creates a verification, stores a payload, and reads it back.",
  });
}

export async function POST() {
  const requestStamp = new Date().toISOString();

  const verification = await createCompanyVerification({
    orgId: "dev-org",
    requestedByUserId: "dev-user",
    inputId: `smoke-${requestStamp}`,
    inputName: "Smoke Test Company",
    country: "PL",
    selectedSectionsJson: ["company", "registry"],
    provider: "VERCLY",
    status: "PROCESSING",
    queriedRegistersJson: ["KRS"],
    stateAsOfDate: new Date(),
  });

  await appendCompanyVerificationPayload({
    verificationId: verification.id,
    isFinal: true,
    payloadJson: {
      provider: "VERCLY",
      snapshot: "dev-smoke",
      summary: {
        companyName: verification.inputName,
        country: verification.country,
      },
    },
  });

  await markCompanyVerificationStatus(
    verification.id,
    CompanyVerificationStatus.COMPLETED,
  );

  const aggregate = await getCompanyVerificationById(verification.id);

  return NextResponse.json({
    status: "ok",
    verificationId: verification.id,
    aggregate,
  });
}