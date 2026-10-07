import { NextResponse } from "next/server";
import { hasDemoSession } from "../../../../src/server/demo-auth";
import { isSameOriginRequest } from "../../../../src/server/request-origin";
import { runXrayKysLookup, toPublicSection, validateXrayRequest } from "../../../../src/server/xray-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.TARGET_ENVIRONMENT !== "development") return NextResponse.json({ error: "Środowisko niedostępne." }, { status: 404 });
  if (!await hasDemoSession(request)) return NextResponse.json({ error: "Wymagane logowanie." }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 403 });
  const organizationId = process.env.SRM_DEVELOPMENT_ORGANIZATION_ID;
  if (!organizationId) return NextResponse.json({ error: "Środowisko SRM nie jest skonfigurowane." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 }); }
  let input;
  try { input = validateXrayRequest(body); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nieprawidłowy NIP." }, { status: 400 });
  }
  try {
    const section = await runXrayKysLookup(organizationId, input);
    return NextResponse.json({ section: toPublicSection(section) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "Nie udało się pobrać lub zapisać raportu KYS. Spróbuj ponownie później." }, { status: 503 });
  }
}
