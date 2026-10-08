import { productEnvironmentReady, productOrganizationId } from "../../../../src/server/runtime-environment";
import { NextResponse } from "next/server";
import { hasDemoSession } from "../../../../src/server/demo-auth";
import { isSameOriginRequest } from "../../../../src/server/request-origin";
import { buildFinancialExcel, validateFinancialExcelSelection } from "../../../../src/server/financial-excel";
import { readSavedFinancialData } from "../../../../src/server/shared-catalog";
import { validateXrayRequest } from "../../../../src/server/xray-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!productEnvironmentReady()) return NextResponse.json({ error: "Środowisko niedostępne." }, { status: 404 });
  if (!await hasDemoSession(request)) return NextResponse.json({ error: "Wymagane logowanie." }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 403 });
  const organizationId = productOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "Środowisko SRM nie jest skonfigurowane." }, { status: 503 });
  let selection;
  try {
    selection = validateFinancialExcelSelection(await request.json());
    validateXrayRequest({ identifier: selection.nip });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nieprawidłowe dane." }, { status: 400 });
  }
  try {
    const data = await readSavedFinancialData(organizationId, selection.nip);
    if (!data) return NextResponse.json({ error: "Nie znaleziono zapisanego raportu finansowego dla tego NIP-u." }, { status: 404 });
    const { filename, bytes } = await buildFinancialExcel(data, selection);
    return new NextResponse(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Download-Filename": filename,
      "Cache-Control": "no-store",
      "Content-Length": String(bytes.byteLength),
    } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Wybrane lata")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Nie udało się przygotować pliku Excel." }, { status: 503 });
  }
}
