import { NextResponse } from "next/server";
import { isSameOriginRequest } from "../../../../src/server/request-origin";
import { runXrayLookup, validateXrayRequest } from "../../../../src/server/xray-lookup";
import { DevelopmentLookupLimitError } from "../../../../src/server/xray-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.TARGET_ENVIRONMENT !== "development") return NextResponse.json({ error: "Środowisko niedostępne." }, { status: 404 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 403 });
  const organizationId = process.env.SRM_DEVELOPMENT_ORGANIZATION_ID;
  if (!organizationId) return NextResponse.json({ error: "Środowisko SRM nie jest skonfigurowane." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 }); }
  let input;
  try { input = validateXrayRequest(body); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nieprawidłowe dane." }, { status: 400 });
  }
  try {
    const card = await runXrayLookup(organizationId, input);
    return NextResponse.json(card, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DevelopmentLookupLimitError) return NextResponse.json({ error: "Dzisiejszy limit zapytań Development został osiągnięty. Spróbuj jutro." }, { status: 429 });
    return NextResponse.json({ error: "Nie udało się zapisać raportu. Spróbuj ponownie później." }, { status: 503 });
  }
}
