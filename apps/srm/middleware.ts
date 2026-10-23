import { NextResponse, type NextRequest } from "next/server";
import { hasDemoSession } from "./src/server/demo-auth";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/health" || path === "/api/auth/login" || path === "/api/auth/logout") return NextResponse.next();
  // These pages contain a neutral shell/sign-in UI only. Their client session
  // state is not data authority: every admitted API still verifies its own
  // current backend identity, membership, product, permissions and resource.
  if (["/", "/login"].includes(path) && process.env.PROFITIA_AUTH_PROVIDER === "clerk") {
    return NextResponse.next({ headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, Authorization" } });
  }
  // These accepted entries own their complete backend identity/permission/audit
  // boundary. Other legacy entrances are still closed in explicit Clerk mode.
  if (["/api/xray/report-data", "/api/xray/financial-excel", "/api/xray/financial-summary", "/api/xray/requests",
    "/api/xray/search", "/api/xray/lookup", "/api/xray/jdg", "/api/xray/jdg/kys",
    "/api/xray/kys", "/api/xray/kys/pesel", "/api/xray/kys/pdf", "/api/xray/kys/krs", "/api/xray/web-identity", "/api/supplier-locations",
    "/api/xray/krs/status", "/api/xray/krs/search", "/api/xray/krs/verify", "/api/xray/krs/lookup"].includes(path) && process.env.PROFITIA_AUTH_PROVIDER === "clerk") {
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
