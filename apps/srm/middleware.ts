import { NextResponse, type NextRequest } from "next/server";
import { hasDemoSession } from "./src/server/demo-auth";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/health" || path === "/api/auth/login" || path === "/api/auth/logout") return NextResponse.next();
  // This accepted entry owns its complete backend identity/permission/audit
  // boundary. Other legacy entrances are still closed in explicit Clerk mode.
  if (path === "/api/xray/report-data" && process.env.PROFITIA_AUTH_PROVIDER === "clerk") {
    return NextResponse.next({ headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, Authorization" } });
  }
  const authenticated = await hasDemoSession(request);
  if (path === "/login") return authenticated
    ? NextResponse.redirect(new URL("/", request.url))
    : NextResponse.next({ headers: { "Cache-Control": "no-store" } });
  if (authenticated) return NextResponse.next({ headers: { "Cache-Control": "no-store" } });
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Wymagane logowanie." }, {
    status: 401, headers: { "Cache-Control": "no-store" },
  });
  return NextResponse.redirect(new URL("/login", request.url), { headers: { "Cache-Control": "no-store" } });
}

export const config = { matcher: ["/((?!_next/|favicon.ico|porr-demo/|.*\\..*).*)"] };
