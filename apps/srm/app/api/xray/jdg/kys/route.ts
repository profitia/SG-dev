import {
  productEnvironmentReady,
  productOrganizationId,
} from "../../../../../src/server/runtime-environment";
import { NextResponse } from "next/server";
import { hasDemoSession } from "../../../../../src/server/demo-auth";
import { isSameOriginRequest } from "../../../../../src/server/request-origin";
import {
  runXrayKysLookup,
  validateXrayRequest,
} from "../../../../../src/server/xray-lookup";
import { toPublicKysSection } from "../../../../../src/server/pesel-reveal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!productEnvironmentReady())
    return NextResponse.json(
      { error: "Środowisko niedostępne." },
      { status: 404 },
    );
  if (!(await hasDemoSession(request)))
    return NextResponse.json({ error: "Wymagane logowanie." }, { status: 401 });
  if (!isSameOriginRequest(request))
    return NextResponse.json(
      { error: "Nieprawidłowe żądanie." },
      { status: 403 },
    );
  const organizationId = productOrganizationId();
  if (!organizationId)
    return NextResponse.json(
      { error: "Środowisko SRM nie jest skonfigurowane." },
      { status: 503 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Nieprawidłowe żądanie." },
      { status: 400 },
    );
  }
  let input;
  try {
    input = validateXrayRequest(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieprawidłowy NIP." },
      { status: 400 },
    );
  }
  try {
    const { section, snapshotId } = await runXrayKysLookup(
      organizationId,
      input,
      "JDG",
    );
    return NextResponse.json(
      {
        section: toPublicKysSection(
          section,
          snapshotId,
          process.env.SRM_DEMO_SESSION_SECRET ?? "",
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Nie udało się pobrać lub zapisać raportu KYS. Spróbuj ponownie później.",
      },
      { status: 503 },
    );
  }
}
