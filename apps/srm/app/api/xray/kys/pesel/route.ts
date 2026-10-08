import { productEnvironmentReady, productOrganizationId } from "../../../../../src/server/runtime-environment";
import { NextResponse } from "next/server";
import { hasDemoSession } from "../../../../../src/server/demo-auth";
import { verifyPeselToken } from "../../../../../src/server/pesel-reveal";
import { isSameOriginRequest } from "../../../../../src/server/request-origin";
import { readKysPersonPesel } from "../../../../../src/server/xray-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!productEnvironmentReady()) return NextResponse.json({ error: "Środowisko niedostępne." }, { status: 404, headers });
  if (!await hasDemoSession(request)) return NextResponse.json({ error: "Wymagane logowanie." }, { status: 401, headers });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 403, headers });
  const organizationId = productOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "Środowisko SRM nie jest skonfigurowane." }, { status: 503, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400, headers }); }
  const token = body && typeof body === "object" && !Array.isArray(body) ? (body as { token?: unknown }).token : null;
  const reference = verifyPeselToken(process.env.SRM_DEMO_SESSION_SECRET ?? "", token);
  if (!reference) return NextResponse.json({ error: "Ujawnienie numeru nie jest już dostępne. Pobierz raport ponownie." }, { status: 400, headers });
  try {
    const pesel = await readKysPersonPesel(organizationId, reference.snapshotId, reference.list, reference.index);
    if (!pesel) return NextResponse.json({ error: "Numer nie jest dostępny." }, { status: 404, headers });
    return NextResponse.json({ pesel }, { headers });
  } catch {
    return NextResponse.json({ error: "Nie udało się ujawnić numeru." }, { status: 503, headers });
  }
}
