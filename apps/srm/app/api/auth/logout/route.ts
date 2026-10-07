import { NextResponse } from "next/server";
import { SRM_SESSION_COOKIE } from "../../../../src/server/demo-auth";
import { isSameOriginRequest } from "../../../../src/server/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 403 });
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303, headers: { "Cache-Control": "no-store" } });
  response.cookies.delete(SRM_SESSION_COOKIE);
  return response;
}
