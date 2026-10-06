import { NextResponse } from "next/server";
import { clearDevelopmentSession, hasDevelopmentSession, issueDevelopmentSession, verifyDevelopmentCode } from "../../../src/server/development-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (process.env.TARGET_ENVIRONMENT !== "development") return NextResponse.json({ error: "Środowisko niedostępne." }, { status: 404 });
  return NextResponse.json({ authorized: hasDevelopmentSession(request) }, { headers: noStore });
}

export async function POST(request: Request) {
  if (process.env.TARGET_ENVIRONMENT !== "development") return NextResponse.json({ error: "Środowisko niedostępne." }, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 }); }
  const code = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).code : null;
  if (!verifyDevelopmentCode(code)) return NextResponse.json({ error: "Nieprawidłowy kod dostępu." }, { status: 401, headers: noStore });
  const response = NextResponse.json({ authorized: true }, { headers: noStore });
  response.headers.set("Set-Cookie", issueDevelopmentSession(request));
  return response;
}

export async function DELETE(request: Request) {
  if (process.env.TARGET_ENVIRONMENT !== "development") return NextResponse.json({ error: "Środowisko niedostępne." }, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 403 });
  const response = NextResponse.json({ authorized: false }, { headers: noStore });
  response.headers.set("Set-Cookie", clearDevelopmentSession(request));
  return response;
}
