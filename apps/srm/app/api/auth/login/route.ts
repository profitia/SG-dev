import { NextResponse } from "next/server";
import { createDemoSession, demoAuthReady, passwordMatches, SRM_SESSION_COOKIE, SRM_SESSION_MAX_AGE_SECONDS } from "../../../../src/server/demo-auth";
import { isSameOriginRequest, sameOriginRedirectUrl } from "../../../../src/server/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 403 });
  const destination = sameOriginRedirectUrl(request, "/login");
  if (!demoAuthReady()) {
    destination.searchParams.set("error", "configuration");
    return NextResponse.redirect(destination, { status: 303, headers: { "Cache-Control": "no-store" } });
  }
  let password: string;
  try {
    const body = await request.formData();
    password = String(body.get("password") ?? "");
  } catch { return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 }); }
  if (!await passwordMatches(password, process.env.SRM_DEMO_PASSWORD!)) {
    destination.searchParams.set("error", "invalid");
    const response = NextResponse.redirect(destination, { status: 303, headers: { "Cache-Control": "no-store" } });
    response.cookies.delete(SRM_SESSION_COOKIE);
    return response;
  }
  const response = NextResponse.redirect(sameOriginRedirectUrl(request, "/"), { status: 303, headers: { "Cache-Control": "no-store" } });
  response.cookies.set({
    name: SRM_SESSION_COOKIE,
    value: await createDemoSession(process.env.SRM_DEMO_SESSION_SECRET!),
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: SRM_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
