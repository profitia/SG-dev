import { atLookupStage, logProviderOutcome } from "./lookup-diagnostics";
import type { JdgRegistryData, SectionEnvelope } from "@profitia/srm-xray";
import { fetchCeidgJdg } from "./integrations/ceidg";
import { appendSectionProjection, appendSnapshot, createLookup, finishAttempt, startAttempt, type TerminalStatus } from "./xray-repository";

export type JdgLookupPorts = {
  createLookup: typeof createLookup;
  startAttempt: typeof startAttempt;
  fetchCeidgJdg: typeof fetchCeidgJdg;
  appendSnapshot: typeof appendSnapshot;
  appendSectionProjection: typeof appendSectionProjection;
  finishAttempt: typeof finishAttempt;
};
const legacyJdgPorts: Readonly<JdgLookupPorts> = Object.freeze({
  createLookup, startAttempt, fetchCeidgJdg, appendSnapshot, appendSectionProjection, finishAttempt,
});
const jdgPortNames = Object.freeze(Object.keys(legacyJdgPorts).sort());

/** Capture every dependency explicitly. Native consumers must supply their
 * own admitted persistence and transport; no missing port falls back to demo. */
export function createJdgLookup(input: JdgLookupPorts) {
  if (typeof window !== "undefined" || !input || Object.getPrototypeOf(input) !== Object.prototype
    || Object.keys(input).sort().join(",") !== jdgPortNames.join(",")
    || Reflect.ownKeys(input).length !== jdgPortNames.length
    || Object.values(Object.getOwnPropertyDescriptors(input)).some(d => !("value" in d) || !d.enumerable || typeof d.value !== "function")) {
    throw new TypeError("Complete explicit JDG ports required");
  }
  const ports: Readonly<JdgLookupPorts> = Object.freeze({ ...input });
  return async (organizationId: string, nip: string): Promise<SectionEnvelope<JdgRegistryData>> => {
    if (typeof organizationId !== "string" || typeof nip !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(organizationId)
      || !/^[0-9]{10}$/.test(nip) || nip === "0000000000") throw new TypeError("Explicit JDG selection required");
    return runJdgLookupWithPorts(ports, organizationId, nip);
  };
}

/** Existing callers retain the same engine and dependencies. */
export async function runJdgLookup(organizationId: string, nip: string): Promise<SectionEnvelope<JdgRegistryData>> {
  return runJdgLookupWithPorts(legacyJdgPorts, organizationId, nip);
}

async function runJdgLookupWithPorts(ports: Readonly<JdgLookupPorts>, organizationId: string, nip: string): Promise<SectionEnvelope<JdgRegistryData>> {
  const lookup = await atLookupStage("lookup_registration", () => ports.createLookup(organizationId, { type: "NIP", value: nip }, "JDG"), "jdg");
  const attemptId = await atLookupStage("attempt_persistence", () => ports.startAttempt(organizationId, lookup.requestId, "jdg"), "jdg");
  try {
    const result = await atLookupStage("provider_retrieval", () => ports.fetchCeidgJdg(nip), "jdg");
    logProviderOutcome("CEIDG", "jdg", result.section.status, result.errorCode);
    if (result.section.data && result.snapshot && result.section.retrievedAt) {
      const snapshotId = await atLookupStage("snapshot_persistence", () => ports.appendSnapshot(organizationId, {
        attemptId, supplierId: lookup.supplierId, section: "jdg", dataClass: "JDG_REGISTRY",
        sourceRecordId: result.section.source.recordId ?? undefined,
        payload: result.snapshot, retrievedAt: new Date(result.section.retrievedAt!),
        retentionUntil: new Date(Date.parse(result.section.retrievedAt!) + 30 * 24 * 60 * 60 * 1000),
      }), "jdg");
      await atLookupStage("projection_persistence", () => ports.appendSectionProjection(organizationId, {
        supplierId: lookup.supplierId, snapshotId, section: "jdg", version: 1, data: result.section.data,
      }), "jdg");
    }
    const status: TerminalStatus = result.section.status === "ERROR"
      ? result.errorCode === "TIMEOUT" ? "TIMEOUT" : "ERROR"
      : result.section.status === "EMPTY" ? "NO_DATA" : "SUCCESS";
    await ports.finishAttempt(organizationId, attemptId, status, {
      providerRecordId: result.section.source.recordId ?? undefined,
      errorCode: result.errorCode ?? undefined,
    });
    return result.section;
  } catch (error) {
    await ports.finishAttempt(organizationId, attemptId, "ERROR", { errorCode: "SRM_PERSISTENCE_ERROR" }).catch(() => {});
    throw error;
  }
}
