import { atLookupStage, logProviderOutcome } from "./lookup-diagnostics";
import type { JdgRegistryData, SectionEnvelope } from "@profitia/srm-xray";
import { fetchCeidgJdg } from "./integrations/ceidg";
import { appendSectionProjection, appendSnapshot, createLookup, finishAttempt, startAttempt, type TerminalStatus } from "./xray-repository";

export async function runJdgLookup(organizationId: string, nip: string): Promise<SectionEnvelope<JdgRegistryData>> {
  const lookup = await atLookupStage("lookup_registration", () => createLookup(organizationId, { type: "NIP", value: nip }, "JDG"), "jdg");
  const attemptId = await atLookupStage("attempt_persistence", () => startAttempt(organizationId, lookup.requestId, "jdg"), "jdg");
  try {
    const result = await atLookupStage("provider_retrieval", () => fetchCeidgJdg(nip), "jdg");
    logProviderOutcome("CEIDG", "jdg", result.section.status, result.errorCode);
    if (result.section.data && result.snapshot && result.section.retrievedAt) {
      const snapshotId = await atLookupStage("snapshot_persistence", () => appendSnapshot(organizationId, {
        attemptId, supplierId: lookup.supplierId, section: "jdg", dataClass: "JDG_REGISTRY",
        sourceRecordId: result.section.source.recordId ?? undefined,
        payload: result.snapshot, retrievedAt: new Date(result.section.retrievedAt!),
        retentionUntil: new Date(Date.parse(result.section.retrievedAt!) + 30 * 24 * 60 * 60 * 1000),
      }), "jdg");
      await atLookupStage("projection_persistence", () => appendSectionProjection(organizationId, {
        supplierId: lookup.supplierId, snapshotId, section: "jdg", version: 1, data: result.section.data,
      }), "jdg");
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
