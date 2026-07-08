import { NextResponse } from "next/server";

import { pollVerificationOnce } from "@/features/verifications/server/orchestration";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await pollVerificationOnce(id);

  if (!result) {
    return NextResponse.json(
      {
        status: "not_found",
        verificationId: id,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    status: "ok",
    pollingMode: "single-step",
    result,
  });
}