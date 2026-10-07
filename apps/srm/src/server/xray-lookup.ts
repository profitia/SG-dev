import type { SectionEnvelope, SupplierXRayCard } from "@profitia/srm-xray";
import { emptyCard } from "../demo/fixture";
import { fetchMgbiGeneral, type CompanyIdentifier } from "./mgbi-general";
import { fetchMgbiFinancial, type FinancialSourceFact } from "./mgbi-financial";
import { fetchVerclyKys } from "./vercly-kys";
import { appendFinancialFacts, appendSectionProjection, appendSnapshot, createLookup, finishAttempt, purgeExpiredKysPersonal, registerOrganization, startAttempt, type Section } from "./xray-repository";

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
): Promise<string | null> {
  const attemptId = await startAttempt(organizationId, lookup.requestId, sectionName);
  try {
    let storedSnapshotId: string | null = null;
    if (section.data && section.retrievedAt && section.status !== "PENDING") {
      if (sectionName === "kys" && sourcePayload !== undefined) throw new Error("Raw KYS payload must not be persisted");
      // Only normalized company fields and financial facts may enter snapshots.
      // The raw WP response contains personal identifiers.
      const snapshotId = await appendSnapshot(organizationId, {
        attemptId, supplierId: lookup.supplierId, section: sectionName,
        dataClass: sectionName === "kys" ? "KYS_PERSONAL" : sectionName === "financial" ? "FINANCIAL" : "COMPANY",
        sourceRecordId: section.source.recordId ?? undefined, payload: sourcePayload ?? section.data,
        retrievedAt: new Date(section.retrievedAt),
        effectiveAt: section.effectiveAt && !Number.isNaN(Date.parse(section.effectiveAt)) ? new Date(section.effectiveAt) : undefined,
        ...(sectionName === "kys" ? { retentionUntil: new Date(Date.parse(section.retrievedAt) + 7 * 24 * 60 * 60 * 1000) } : {}),
      });
      storedSnapshotId = snapshotId;
      await appendSectionProjection(organizationId, { supplierId: lookup.supplierId, snapshotId, section: sectionName, version: 1, data: section.data });
      if (sectionName === "financial" && facts.length) await appendFinancialFacts(organizationId, facts.map((fact) => ({ ...fact, supplierId: lookup.supplierId, snapshotId })));
    }
    await finishAttempt(organizationId, attemptId, attemptStatus(section.status, errorCode), {
      correlationId: correlationId ?? undefined, providerRecordId: section.source.recordId ?? undefined, errorCode: errorCode ?? undefined,
    });
    return storedSnapshotId;
  } catch (error) {
    await finishAttempt(organizationId, attemptId, "ERROR", { errorCode: "SRM_PERSISTENCE_ERROR" }).catch(() => {});
    throw error;
  }
}

export async function runXrayLookup(organizationId: string, request: XrayLookupRequest): Promise<SupplierXRayCard> {
  await registerOrganization(organizationId, "srm-development");
  const lookup = await createLookup(organizationId, request.identifier);
  const [general, financial] = await Promise.all([
    fetchMgbiGeneral(request.identifier).catch(() => ({
      section: { ...emptyCard.general, status: "ERROR" as const, retrievedAt: new Date().toISOString(), warnings: ["MGBI_NOT_CONFIGURED"] },
      rawRecord: null, errorCode: "NOT_CONFIGURED",
    })),
    fetchMgbiFinancial(request.identifier).catch(() => ({
      section: { ...emptyCard.financial, status: "ERROR" as const, retrievedAt: new Date().toISOString(), warnings: ["MGBI_NOT_CONFIGURED"] },
      facts: [], sourceData: undefined, errorCode: "NOT_CONFIGURED",
    })),
  ]);
  await persistSection(organizationId, lookup, "general", general.section, general.errorCode);
  await persistSection(organizationId, lookup, "financial", financial.section, financial.errorCode, financial.facts, undefined, financial.sourceData);

  return {
    identity: {
      krs: general.section.data?.krs ?? null,
      nip: general.section.data?.nip ?? request.identifier.value,
      name: general.section.data?.legalName ?? null,
    },
    general: general.section,
    financial: financial.section,
    kys: emptyCard.kys,
  };
}

export async function runXrayKysLookup(organizationId: string, request: XrayLookupRequest, entityType: "COMPANY" | "JDG" = "COMPANY"): Promise<{ section: SupplierXRayCard["kys"]; snapshotId: string | null }> {
  await purgeExpiredKysPersonal(organizationId);
  await registerOrganization(organizationId, "srm-development");
  const lookup = await createLookup(organizationId, request.identifier, entityType);
  const result = await fetchVerclyKys({ identifier: request.identifier });
  const snapshotId = await persistSection(organizationId, lookup, "kys", result.section, result.errorCode, [], result.correlationId);
  return { section: result.section, snapshotId };
}
