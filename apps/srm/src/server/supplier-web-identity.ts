import type { SupplierWebIdentityData } from "@profitia/srm-xray";
import { hasDemoSession } from "./demo-auth";
import { isSameOriginRequest } from "./request-origin";
import { productEnvironmentReady, productOrganizationId } from "./runtime-environment";
import { validateXrayRequest } from "./xray-lookup";
import { discoverWebsite } from "./website-discovery";
import { claimWebIdentity, readWebSubject, saveWebIdentity, subjectHash } from "./supplier-web-store";

const dependencies = {
  ready: productEnvironmentReady, authorized: hasDemoSession, sameOrigin: isSameOriginRequest,
  organization: productOrganizationId, subject: readWebSubject, claim: claimWebIdentity, save: saveWebIdentity, discover: discoverWebsite,
};
export function emptyWebIdentity(status: SupplierWebIdentityData["status"]): SupplierWebIdentityData {
  return { status, websiteUrl: null, logoDataUrl: null, evidenceUrl: null, logoSourceUrl: null, method: null, checkedAt: null };
}
export async function supplierWebIdentityHandler(request: Request, deps = dependencies): Promise<Response> {
  const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (!deps.ready()) return response({ error: "Środowisko niedostępne." }, 404);
  if (!await deps.authorized(request)) return response({ error: "Wymagane logowanie." }, 401);
  if (!deps.sameOrigin(request)) return response({ error: "Nieprawidłowe żądanie." }, 403);
  const organizationId = deps.organization();
  if (!organizationId) return response({ error: "Środowisko niedostępne." }, 503);
  let nip: string, entityType: "COMPANY" | "JDG";
  try {
    const body = await request.json();
    nip = validateXrayRequest(body).identifier.value;
    if (body.entityType !== "COMPANY" && body.entityType !== "JDG") throw new Error("INVALID_ENTITY");
    entityType = body.entityType;
  } catch { return response({ error: "Nieprawidłowy NIP lub typ podmiotu." }, 400); }
  try {
    const subject = await deps.subject(organizationId, nip, entityType);
    if (!subject) return response(emptyWebIdentity("NOT_FOUND"), 404);
    const hash = subjectHash(subject), claim = await deps.claim(organizationId, nip, entityType, hash);
    if (claim.kind === "CACHED") return response(claim.data);
    if (claim.kind === "PENDING") return response(emptyWebIdentity("PENDING"), 202);
    let data: SupplierWebIdentityData;
    try { data = { ...await deps.discover(subject), checkedAt: new Date().toISOString() }; }
    catch { data = { ...emptyWebIdentity("UNAVAILABLE"), checkedAt: new Date().toISOString() }; }
    await deps.save(organizationId, nip, entityType, hash, claim.token, data);
    return response(data);
  } catch {
    console.warn(JSON.stringify({ event: "srm_website_enrichment_unavailable" }));
    return response(emptyWebIdentity("UNAVAILABLE"), 503);
  }
}
