import type { JdgRegistryData, SectionEnvelope } from "@profitia/srm-xray";
import { fetchCeidgJdg } from "./integrations/ceidg";
import { appendSectionProjection, appendSnapshot, createLookup, finishAttempt, registerOrganization, startAttempt, type TerminalStatus } from "./xray-repository";

export async function runJdgLookup(organizationId: string, nip: string): Promise<SectionEnvelope<JdgRegistryData>> {
  await registerOrganization(organizationId, "srm-development");
  const lookup = await createLookup(organizationId, { type: "NIP", value: nip }, "JDG");
  const attemptId = await startAttempt(organizationId, lookup.requestId, "jdg");
  try {
    const result = await fetchCeidgJdg(nip);
    if (result.section.data && result.snapshot && result.section.retrievedAt) {
      const snapshotId = await appendSnapshot(organizationId, {
        attemptId, supplierId: lookup.supplierId, section: "jdg", dataClass: "JDG_REGISTRY",
        sourceRecordId: result.section.source.recordId ?? undefined,
        payload: result.snapshot, retrievedAt: new Date(result.section.retrievedAt),
        retentionUntil: new Date(Date.parse(result.section.retrievedAt) + 30 * 24 * 60 * 60 * 1000),
      });
      await appendSectionProjection(organizationId, {
        supplierId: lookup.supplierId, snapshotId, section: "jdg", version: 1, data: result.section.data,
      });
    }
    const status: TerminalStatus = result.section.status === "ERROR"
      ? result.errorCode === "TIMEOUT" ? "TIMEOUT" : "ERROR"
      : result.section.status === "EMPTY" ? "NO_DATA" : "SUCCESS";
    await finishAttempt(organizationId, attemptId, status, {
      providerRecordId: result.section.source.recordId ?? undefined,
      errorCode: result.errorCode ?? undefined,
    });
    return result.section;
  } catch (error) {
    await finishAttempt(organizationId, attemptId, "ERROR", { errorCode: "SRM_PERSISTENCE_ERROR" }).catch(() => {});
    throw error;
  }
}
