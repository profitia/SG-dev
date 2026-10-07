import { NextResponse } from "next/server";
import { hasDemoSession } from "../../../../src/server/demo-auth";
import { searchRegistryByNip } from "../../../../src/server/registry-search";
import { isSameOriginRequest } from "../../../../src/server/request-origin";
import { toPublicSection, validateXrayRequest } from "../../../../src/server/xray-lookup";

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nieprawidłowe dane." }, { status: 400 });
  }

  try {
    const result = await searchRegistryByNip(organizationId, input);
    const headers = { "Cache-Control": "no-store" };
    if (result.entityType === "JDG") {
      return NextResponse.json({ entityType: "JDG", nip: result.nip, section: toPublicSection(result.section) }, { headers });
    }
    if (result.entityType === "COMPANY") {
      const card = result.card;
      return NextResponse.json({ entityType: "COMPANY", card: {
        identity: card.identity,
        general: toPublicSection(card.general),
        financial: toPublicSection(card.financial),
        kys: toPublicSection(card.kys),
      } }, { headers });
    }
    if (result.entityType === "NOT_FOUND") return NextResponse.json({ error: "Nie znaleziono podmiotu o podanym numerze NIP." }, { status: 404, headers });
    return NextResponse.json({ error: "Nie udało się ustalić typu podmiotu. Spróbuj ponownie później." }, { status: 503, headers });
  } catch (error) {
    return NextResponse.json({ error: "Nie udało się pobrać i zapisać danych. Spróbuj ponownie później." }, { status: 503 });
  }
}
