import type { SupplierXRayCard } from "@profitia/srm-xray";
import { emptyCard } from "../demo/fixture";
import { fetchVerclyKys, type VerclyKysRequest } from "./vercly-kys";
import { appendSectionProjection, appendSnapshot, createLookup, finishAttempt, registerOrganization, startAttempt } from "./xray-repository";

export function validateKysRequest(input: unknown): VerclyKysRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Nieprawidłowe dane wyszukiwania.");
  const value = input as Record<string, unknown>;
  const type = value.kind === "nip" ? "NIP" : value.kind === "krs" ? "KRS" : null;
  const identifier = typeof value.identifier === "string" ? value.identifier.replace(/[\s-]/g, "") : "";
  if (!type || !/^[0-9]{10}$/.test(identifier)) throw new Error("Podaj poprawny NIP albo KRS (10 cyfr).");
  if (type === "NIP") {
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    const check = weights.reduce((sum, weight, index) => sum + weight * Number(identifier[index]), 0) % 11;
    if (check === 10 || check !== Number(identifier[9])) throw new Error("Nieprawidłowa cyfra kontrolna NIP.");
  }
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const website = typeof value.website === "string" ? value.website.trim() : "";
  const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  if (!name || name.length > 200 || website.length > 300 || !phone || phone.length > 40) {
    throw new Error("Pełny raport Vercly wymaga nazwy i telefonu firmy.");
  }
  if (website) {
    try {
      const url = new URL(website);
      if (url.protocol !== "https:" || !url.hostname.includes(".")) throw new Error();
    } catch { throw new Error("Podaj poprawny adres strony WWW z HTTPS."); }
  }
  if (!/^[+0-9()\s-]{7,40}$/.test(phone)) throw new Error("Podaj poprawny telefon firmy.");
  return { identifier: { type, value: identifier }, name, ...(website ? { website } : {}), phone };
}

export async function runKysLookup(organizationId: string, request: VerclyKysRequest): Promise<SupplierXRayCard> {
  await registerOrganization(organizationId, "srm-development");
  const lookup = await createLookup(organizationId, request.identifier);
  const attemptId = await startAttempt(organizationId, lookup.requestId, "kys");
  try {
    const result = await fetchVerclyKys(request);
    const section = result.section;
    if (section.data && section.status !== "PENDING") {
      const retrievedAt = new Date(section.retrievedAt!);
      const snapshotId = await appendSnapshot(organizationId, {
        attemptId, supplierId: lookup.supplierId, section: "kys", dataClass: "KYS_REDACTED",
        sourceRecordId: result.reportId ?? undefined, payload: section.data, retrievedAt,
        effectiveAt: section.effectiveAt ? new Date(section.effectiveAt) : undefined,
        retentionUntil: new Date(retrievedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      });
      await appendSectionProjection(organizationId, { supplierId: lookup.supplierId, snapshotId, section: "kys", version: 1, data: section.data });
    }
    await finishAttempt(organizationId, attemptId,
      section.status === "ERROR" ? ["VERCLY_TIMEOUT", "VERCLY_REPORT_NOT_READY"].includes(result.errorCode ?? "") ? "TIMEOUT" : "ERROR" : section.status === "EMPTY" ? "NO_DATA" : "SUCCESS",
      { correlationId: result.correlationId ?? undefined, providerRecordId: result.reportId ?? undefined, errorCode: result.errorCode ?? undefined },
    );
    return {
      ...emptyCard,
      identity: { krs: section.data?.company?.krs ?? (request.identifier.type === "KRS" ? request.identifier.value : null),
        nip: section.data?.company?.nip ?? (request.identifier.type === "NIP" ? request.identifier.value : null),
        name: section.data?.company?.name ?? null },
      kys: section,
    };
  } catch (error) {
    await finishAttempt(organizationId, attemptId, "ERROR", { errorCode: "SRM_PERSISTENCE_ERROR" }).catch(() => {});
    throw error;
  }
}
