import { NextResponse } from "next/server";

import { getLocalVerificationState } from "@/features/verifications/server/orchestration";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const verification = await getLocalVerificationState(id);

  if (!verification) {
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
    verification,
  });
}