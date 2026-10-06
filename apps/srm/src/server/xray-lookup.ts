import type { SupplierXRayCard } from "@profitia/srm-xray";
import { emptyCard } from "../demo/fixture";
import { fetchMgbiGeneral, type CompanyIdentifier } from "./mgbi-general";
import { fetchMgbiFinancial, type FinancialSourceFact } from "./mgbi-financial";
import { fetchVerclyKys } from "./vercly-kys";
import { appendFinancialFacts, appendSectionProjection, appendSnapshot, createLookup, finishAttempt, registerOrganization, startAttempt, type Section } from "./xray-repository";

export type XrayLookupRequest = { identifier: CompanyIdentifier & { type: "NIP" } };

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
): Promise<void> {
  const attemptId = await startAttempt(organizationId, lookup.requestId, sectionName);
  try {
    if (section.data && section.retrievedAt && section.status !== "PENDING") {
      // Only normalized company fields and financial facts may enter snapshots.
      // The raw WP response contains personal identifiers.
      const snapshotId = await appendSnapshot(organizationId, {
        attemptId, supplierId: lookup.supplierId, section: sectionName,
        dataClass: sectionName === "kys" ? "KYS_REDACTED" : sectionName === "financial" ? "FINANCIAL" : "COMPANY",
        sourceRecordId: section.source.recordId ?? undefined, payload: section.data,
        retrievedAt: new Date(section.retrievedAt),
        effectiveAt: section.effectiveAt && !Number.isNaN(Date.parse(section.effectiveAt)) ? new Date(section.effectiveAt) : undefined,
        ...(sectionName === "kys" ? { retentionUntil: new Date(Date.parse(section.retrievedAt) + 30 * 24 * 60 * 60 * 1000) } : {}),
      });
      await appendSectionProjection(organizationId, { supplierId: lookup.supplierId, snapshotId, section: sectionName, version: 1, data: section.data });
      if (sectionName === "financial" && facts.length) await appendFinancialFacts(organizationId, facts.map((fact) => ({ ...fact, supplierId: lookup.supplierId, snapshotId })));
    }
    await finishAttempt(organizationId, attemptId, attemptStatus(section.status, errorCode), {
      correlationId: correlationId ?? undefined, providerRecordId: section.source.recordId ?? undefined, errorCode: errorCode ?? undefined,
    });
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
      facts: [], errorCode: "NOT_CONFIGURED",
    })),
  ]);
  await persistSection(organizationId, lookup, "general", general.section, general.errorCode);
  await persistSection(organizationId, lookup, "financial", financial.section, financial.errorCode, financial.facts);

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

export async function runXrayKysLookup(organizationId: string, request: XrayLookupRequest): Promise<SupplierXRayCard["kys"]> {
  await registerOrganization(organizationId, "srm-development");
  const lookup = await createLookup(organizationId, request.identifier);
  const result = await fetchVerclyKys({ identifier: request.identifier });
  await persistSection(organizationId, lookup, "kys", result.section, result.errorCode, [], result.correlationId);
  return result.section;
}
