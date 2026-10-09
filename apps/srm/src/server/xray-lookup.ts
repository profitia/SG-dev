import { atLookupStage, logProviderOutcome, providerExceptionCode } from "./lookup-diagnostics";
import type { SectionEnvelope, SupplierXRayCard } from "@profitia/srm-xray";
import { emptyCard } from "../demo/fixture";
import { fetchMgbiGeneral, type CompanyIdentifier } from "./mgbi-general";
import { fetchMgbiFinancial, type FinancialSourceFact } from "./mgbi-financial";
import { saveMgbiArchive } from "./mgbi-archive";
import { fetchVerclyKys } from "./vercly-kys";
import { getOrFetchKys, kysExpiry, purgeExpiredSharedKys } from "./kys-cache";
import { readFreshCompany, recordDemoInterest, refreshFinancialIndicators, saveSharedCompany } from "./shared-catalog";
import { appendFinancialFacts, appendSectionProjection, appendSnapshot, createLookup, finishAttempt, purgeExpiredKysPersonal, startAttempt, type Section } from "./xray-repository";

export type XrayLookupRequest = { identifier: CompanyIdentifier & { type: "NIP" } };

/** The browser only needs status and display data; source provenance stays server-side. */
export function toPublicSection<T>(section: SectionEnvelope<T>): Omit<SectionEnvelope<T>, "source"> {
  const warningCodes = section.warnings.map((code) => {
    if (code === "MGBI_NO_STRUCTURED_FINANCIAL_DATA") return "FINANCIAL_NO_STRUCTURED_DATA";
    if (code === "MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS") return "FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE";
    if (code === "MGBI_COST_SIGN_UNVERIFIED") return "FINANCIAL_COST_SIGN_UNVERIFIED";
    if (code === "VERCLY_INCOMPLETE_SOURCES") return "KYS_INCOMPLETE_SOURCES";
    if (code.startsWith("VERCLY_SEVERITY_")) return "KYS_PROVIDER_NOTICE";
    return "REPORT_WARNING";
  });
  return {
    status: section.status,
    retrievedAt: section.retrievedAt,
    effectiveAt: section.effectiveAt,
    data: section.data,
    warnings: [...new Set(warningCodes)],
  };
}

export function validateXrayRequest(input: unknown): XrayLookupRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Nieprawidłowe dane wyszukiwania.");
  const value = input as Record<string, unknown>;
  const identifier = typeof value.identifier === "string" ? value.identifier.replace(/[\s-]/g, "") : "";
  if (!/^[0-9]{10}$/.test(identifier)) throw new Error("Podaj poprawny NIP (10 cyfr).");
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const check = weights.reduce((sum, weight, index) => sum + weight * Number(identifier[index]), 0) % 11;
  if (check === 10 || check !== Number(identifier[9])) throw new Error("Nieprawidłowa cyfra kontrolna NIP.");
  return { identifier: { type: "NIP", value: identifier } };
}

function attemptStatus(status: string, errorCode: string | null): "SUCCESS" | "NO_DATA" | "TIMEOUT" | "ERROR" {
  if (status === "ERROR") return errorCode === "TIMEOUT" || errorCode?.includes("TIMEOUT") ? "TIMEOUT" : "ERROR";
  return status === "EMPTY" || status === "NOT_REQUESTED" ? "NO_DATA" : "SUCCESS";
}

async function persistSection(
  organizationId: string,
  lookup: { supplierId: string; requestId: string },
  sectionName: Section,
  section: SupplierXRayCard[Section],
  errorCode: string | null,
  facts: FinancialSourceFact[] = [],
  correlationId?: string | null,
  sourcePayload?: unknown,
  retrievalMethod: "PROVIDER" | "CACHE" = "PROVIDER",
): Promise<string | null> {
  const attemptId = await atLookupStage("attempt_persistence", () => startAttempt(organizationId, lookup.requestId, sectionName, 1, retrievalMethod), sectionName);
  if (sectionName === "kys") logProviderOutcome("VERCLY", "kys", section.status, errorCode, retrievalMethod);
  try {
    let storedSnapshotId: string | null = null;
    if (section.data && section.retrievedAt && section.status !== "PENDING") {
      if (sectionName === "kys" && sourcePayload !== undefined) throw new Error("Raw KYS payload must not be persisted");
      // Only normalized company fields and financial facts may enter snapshots.
      // The raw WP response contains personal identifiers.
      const snapshotId = await atLookupStage("snapshot_persistence", () => appendSnapshot(organizationId, {
        attemptId, supplierId: lookup.supplierId, section: sectionName,
        dataClass: sectionName === "kys" ? "KYS_PERSONAL" : sectionName === "financial" ? "FINANCIAL" : "COMPANY",
        sourceRecordId: section.source.recordId ?? undefined, payload: sourcePayload ?? section.data,
        retrievedAt: new Date(section.retrievedAt!),
        effectiveAt: section.effectiveAt && !Number.isNaN(Date.parse(section.effectiveAt)) ? new Date(section.effectiveAt) : undefined,
        ...(sectionName === "kys" ? { retentionUntil: kysExpiry(section.retrievedAt!) } : {}),
      }), sectionName);
      storedSnapshotId = snapshotId;
      await atLookupStage("projection_persistence", () => appendSectionProjection(organizationId, { supplierId: lookup.supplierId, snapshotId, section: sectionName,
        version: sectionName === "kys" ? 2 : 1, data: section.data }), sectionName);
      if (sectionName === "financial" && facts.length) await atLookupStage("financial_persistence", () => appendFinancialFacts(organizationId, facts.map((fact) => ({ ...fact, supplierId: lookup.supplierId, snapshotId }))), "financial");
    }
    await atLookupStage("attempt_persistence", () => finishAttempt(organizationId, attemptId, attemptStatus(section.status, errorCode), {
      correlationId: correlationId ?? undefined, providerRecordId: section.source.recordId ?? undefined, errorCode: errorCode ?? undefined,
    }), sectionName);
    return storedSnapshotId;
  } catch (error) {
    await finishAttempt(organizationId, attemptId, "ERROR", { errorCode: "SRM_PERSISTENCE_ERROR" }).catch(() => {});
    throw error;
  }
}

export async function runXrayLookup(organizationId: string, request: XrayLookupRequest): Promise<SupplierXRayCard> {
  const lookup = await atLookupStage("lookup_registration", () => createLookup(organizationId, request.identifier));
  const cached = await atLookupStage("cache_read", () => readFreshCompany(organizationId, request.identifier.value));
  if (cached) {
    logProviderOutcome("MGBI", "general", cached.general.status, null, "CACHE");
    logProviderOutcome("MGBI", "financial", cached.financial.status, null, "CACHE");
    const financial = cached.financial.data
      ? { ...cached.financial, data: { ...cached.financial.data, indicators: await refreshFinancialIndicators(organizationId, request.identifier.value, cached.financial.data) } }
      : cached.financial;
    await recordDemoInterest(organizationId, request.identifier.value);
    return {
      identity: {
        krs: cached.general.data?.krs ?? null,
        nip: cached.general.data?.nip ?? request.identifier.value,
        name: cached.general.data?.legalName ?? null,
      },
      general: cached.general, financial, kys: emptyCard.kys,
    };
  }
  const [general, financial] = await Promise.all([
    fetchMgbiGeneral(request.identifier).catch((error) => ({
      section: { ...emptyCard.general, status: "ERROR" as const, retrievedAt: new Date().toISOString(), warnings: ["MGBI_NOT_CONFIGURED"] },
      rawRecord: null, rawResponse: undefined, errorCode: providerExceptionCode(error),
    })),
    fetchMgbiFinancial(request.identifier).catch((error) => ({
      section: { ...emptyCard.financial, status: "ERROR" as const, retrievedAt: new Date().toISOString(), warnings: ["MGBI_NOT_CONFIGURED"] },
      facts: [], sourceData: undefined, rawResponse: undefined, errorCode: providerExceptionCode(error),
    })),
  ]);
  logProviderOutcome("MGBI", "general", general.section.status, general.errorCode);
  logProviderOutcome("MGBI", "financial", financial.section.status, financial.errorCode);
  // Keep complete provider responses in a tenant-scoped store, separate from
  // the normalized, person-free catalog reused across organizations.
  await atLookupStage("source_archive", () => Promise.all([
    general.rawResponse && general.section.retrievedAt
      ? saveMgbiArchive(organizationId, request.identifier.value, "pl-krs-wp-record",
        general.rawResponse.pages, general.rawResponse.recordCount, general.section.retrievedAt, lookup.requestId)
      : Promise.resolve(),
    financial.rawResponse && financial.section.retrievedAt
      ? saveMgbiArchive(organizationId, request.identifier.value, "pl-krs-rdf-record",
        financial.rawResponse.pages, financial.rawResponse.recordCount, financial.section.retrievedAt, lookup.requestId)
      : Promise.resolve(),
  ]));
  const generalSnapshotId = await persistSection(organizationId, lookup, "general", general.section, general.errorCode);
  const financialSnapshotId = await persistSection(organizationId, lookup, "financial", financial.section, financial.errorCode, financial.facts, undefined, financial.sourceData);
  await atLookupStage("catalog_persistence", () => saveSharedCompany(organizationId, request.identifier.value, {
    general: general.section, financial: financial.section,
    generalSnapshotId, financialSnapshotId, facts: financial.facts,
  }));
  const financialWithIndicators = financial.section.data
    ? { ...financial.section, data: { ...financial.section.data, indicators: await refreshFinancialIndicators(organizationId, request.identifier.value, financial.section.data) } }
    : financial.section;
  if (general.section.data?.nip === request.identifier.value) await recordDemoInterest(organizationId, request.identifier.value);

  return {
    identity: {
      krs: general.section.data?.krs ?? null,
      nip: general.section.data?.nip ?? request.identifier.value,
      name: general.section.data?.legalName ?? null,
    },
    general: general.section,
    financial: financialWithIndicators,
    kys: emptyCard.kys,
  };
}

export async function runXrayKysLookup(organizationId: string, request: XrayLookupRequest, entityType: "COMPANY" | "JDG" = "COMPANY"): Promise<{ section: SupplierXRayCard["kys"]; snapshotId: string | null }> {
  await atLookupStage("retention_cleanup", () => purgeExpiredKysPersonal(organizationId), "kys");
  await atLookupStage("retention_cleanup", () => purgeExpiredSharedKys(organizationId), "kys");
  const lookup = await atLookupStage("lookup_registration", () => createLookup(organizationId, request.identifier, entityType));
  const result = await getOrFetchKys(organizationId, request.identifier.value, entityType,
    () => atLookupStage("provider_retrieval", () => fetchVerclyKys({ identifier: request.identifier }), "kys"),
    (section, errorCode, correlationId, method) =>
      persistSection(organizationId, lookup, "kys", section, errorCode, [], correlationId, undefined, method),
  );
  return { section: result.section, snapshotId: result.snapshotId };
}
