import type { DatabasePool } from "./db";
import { FINANCIAL_QUALITY_RULE } from "@profitia/srm-xray";
import { isRestrictedRegistrationStatus } from "@profitia/srm-xray";
import { enrichCompanyPkd } from "./company-pkd";
import { COMPANY_IDENTITY_VERSION } from "./company-continuity";
import { isCompanyReportRestricted } from "@profitia/srm-xray";
import { readSupplierRegistrationStatus, readCompanyRegistration } from "./company-activity";
import { atLookupStage, logProviderOutcome, providerExceptionCode } from "./lookup-diagnostics";
import type { SectionEnvelope, SupplierXRayCard } from "@profitia/srm-xray";
import { emptyCard } from "../demo/fixture";
import { fetchMgbiGeneral, type CompanyIdentifier } from "./mgbi-general";
import { fetchMgbiFinancial, reprojectFinancialArchive, type FinancialSourceFact } from "./mgbi-financial";
import { saveFinancialDocuments, readFinancialDocuments, applyFinancialDocumentMetadata } from "./financial-documents";
import { saveMgbiArchive } from "./mgbi-archive";
import { enrichMsrFinancial } from "./msr-repository";
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
    if (["MGBI_FINANCIAL_NO_XML", "MGBI_FINANCIAL_UNKNOWN_FORMAT", "MGBI_FINANCIAL_UNSUPPORTED_XML"].includes(code)) return code.replace("MGBI_", "");
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

export async function persistSection(
  organizationId: string,
  lookup: { supplierId: string; requestId: string },
  sectionName: Section,
  section: SupplierXRayCard[Section],
  errorCode: string | null,
  facts: FinancialSourceFact[] = [],
  correlationId?: string | null,
  sourcePayload?: unknown,
  retrievalMethod: "PROVIDER" | "CACHE" = "PROVIDER",
  pool?: DatabasePool,
): Promise<string | null> {
  const attemptId = await atLookupStage("attempt_persistence", () => startAttempt(organizationId, lookup.requestId, sectionName, 1, retrievalMethod, pool), sectionName);
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
      }, pool), sectionName);
      storedSnapshotId = snapshotId;
      await atLookupStage("projection_persistence", () => appendSectionProjection(organizationId, { supplierId: lookup.supplierId, snapshotId, section: sectionName,
        version: sectionName === "kys" ? 2 : 1, data: section.data }, pool), sectionName);
      if (sectionName === "financial" && facts.length) await atLookupStage("financial_persistence", () => appendFinancialFacts(organizationId, facts.map((fact) => ({ ...fact, supplierId: lookup.supplierId, snapshotId })), pool), "financial");
    }
    await atLookupStage("attempt_persistence", () => finishAttempt(organizationId, attemptId, attemptStatus(section.status, errorCode), {
      correlationId: correlationId ?? undefined, providerRecordId: section.source.recordId ?? undefined, errorCode: errorCode ?? undefined,
    }, pool), sectionName);
    return storedSnapshotId;
  } catch (error) {
    await finishAttempt(organizationId, attemptId, "ERROR", { errorCode: "SRM_PERSISTENCE_ERROR" }, pool).catch(() => {});
    throw error;
  }
}

export async function fetchCompanyFinancial(data: SupplierXRayCard["general"]["data"], identifier: CompanyIdentifier, provider: typeof fetchMgbiFinancial = fetchMgbiFinancial) {
  return isCompanyReportRestricted(data)
    ? { section: emptyCard.financial, facts: [], rawResponse: undefined, sourceData: undefined, errorCode: null }
    : await provider(identifier,{companyHistory:data?.registryHistory}).catch((error) => ({
      section: { ...emptyCard.financial, status: "ERROR" as const, retrievedAt: new Date().toISOString(), warnings: ["MGBI_NOT_CONFIGURED"] },
      facts: [], sourceData: undefined, rawResponse: undefined, errorCode: providerExceptionCode(error),
    }));
}

export async function runXrayLookup(organizationId: string, request: XrayLookupRequest): Promise<SupplierXRayCard> {
  const lookup = await atLookupStage("lookup_registration", () => createLookup(organizationId, request.identifier));
  const cached = await atLookupStage("cache_read", () => readFreshCompany(organizationId, request.identifier.value));
  if (cached) {
    const registration = cached.general.data?.registryHistory ? {status:cached.general.data.registrationStatus,deregisteredAt:cached.general.data.deregisteredAt}
      : await readCompanyRegistration(organizationId, request.identifier.value);
    const companyData = await enrichCompanyPkd(organizationId, request.identifier.value, cached.general);
    const general = { ...cached.general, data: companyData && { ...companyData,
      registrationStatus: registration.status, deregisteredAt: registration.deregisteredAt } };
    const history=general.data?.registryHistory,allowedKrs=history?.members.map(m=>m.krs);
    if (cached.generalReprojected) {
      const snapshotId=await persistSection(organizationId,lookup,"general",general,null,[],undefined,undefined,"CACHE");
      await saveSharedCompany(organizationId,request.identifier.value,{general,financial:cached.financial,generalSnapshotId:snapshotId,financialSnapshotId:null,facts:[]});
    }
    if (isCompanyReportRestricted(general.data)) return {
      identity: { krs: general.data?.krs ?? null, nip: request.identifier.value, name: general.data?.legalName ?? null },
      general, financial: emptyCard.financial, kys: emptyCard.kys,
    };
    logProviderOutcome("MGBI", "general", cached.general.status, null, "CACHE");
    logProviderOutcome("MGBI", "financial", cached.financial.status, null, "CACHE");
    const needsRevisionProjection = cached.financial.data?.revisionRule !== "FINANCIAL_REVISIONS_V1";
    const needsRegistryProjection=!!history && cached.financial.data?.registryHistoryVersion!==COMPANY_IDENTITY_VERSION;
    const needsQualityProjection = !!cached.financial.data && cached.financial.data.qualityRule !== FINANCIAL_QUALITY_RULE;
    const reconstructed = needsRevisionProjection || needsRegistryProjection || needsQualityProjection ? await reprojectFinancialArchive(organizationId,request.identifier.value,history) : null;
    const msr = await atLookupStage("financial_persistence", () => enrichMsrFinancial(organizationId,request.identifier.value,
      reconstructed ?? {section:cached.financial,facts:[],errorCode:null},{requestId:lookup.requestId,allowedKrs,refreshMetadata:async()=>{
        const latest=await fetchMgbiFinancial(request.identifier,{companyHistory:history});
        if (!latest.rawResponse || !latest.section.retrievedAt) throw new Error("MSR_METADATA_REFRESH_FAILED");
        await saveMgbiArchive(organizationId,request.identifier.value,"pl-krs-rdf-record",latest.rawResponse.pages,latest.rawResponse.recordCount,latest.section.retrievedAt,lookup.requestId);
        await saveFinancialDocuments(organizationId,request.identifier.value,latest.rawResponse.pages);
      }}),"financial");
    const documents=await readFinancialDocuments(organizationId,request.identifier.value);
    const savedFinancial = applyFinancialDocumentMetadata(msr.section,documents,history);
    const sourceData=msr.sourceData ? applyFinancialDocumentMetadata({...msr.section,data:msr.sourceData},documents,history).data ?? undefined : undefined;
    if (msr.msrChanged || reconstructed || JSON.stringify(savedFinancial)!==JSON.stringify(cached.financial)) {
      const snapshotId = await persistSection(organizationId,lookup,"financial",savedFinancial,msr.errorCode,msr.facts,undefined,sourceData,"CACHE");
      await saveSharedCompany(organizationId,request.identifier.value,{general,financial:savedFinancial,generalSnapshotId:null,financialSnapshotId:snapshotId,facts:msr.facts,preserveGeneral:true});
    }
    const financial = savedFinancial.data
      ? { ...savedFinancial, data: { ...savedFinancial.data, indicators: await refreshFinancialIndicators(organizationId, request.identifier.value, savedFinancial.data) } }
      : savedFinancial;
    await recordDemoInterest(organizationId, request.identifier.value);
    return {
      identity: {
        krs: cached.general.data?.krs ?? null,
        nip: cached.general.data?.nip ?? request.identifier.value,
        name: cached.general.data?.legalName ?? null,
      },
      general, financial, kys: emptyCard.kys,
    };
  }
  const general = await fetchMgbiGeneral(request.identifier).catch((error) => ({
      section: { ...emptyCard.general, status: "ERROR" as const, retrievedAt: new Date().toISOString(), warnings: ["MGBI_NOT_CONFIGURED"] },
      rawRecord: null, rawResponse: undefined, errorCode: providerExceptionCode(error),
    }));
  if (general.errorCode === "COMPANY_IDENTITY_AMBIGUOUS") {
    logProviderOutcome("MGBI","general","ERROR",general.errorCode);
    throw new Error("MGBI_COMPANY_IDENTITY_AMBIGUOUS");
  }
  let financial = await fetchCompanyFinancial(general.section.data, request.identifier);
  logProviderOutcome("MGBI", "general", general.section.status, general.errorCode);
  if (!isCompanyReportRestricted(general.section.data)) logProviderOutcome("MGBI", "financial", financial.section.status, financial.errorCode);
  // Keep complete provider responses in a tenant-scoped store, separate from
  // the normalized, person-free catalog reused across organizations.
  await atLookupStage("source_archive", () => Promise.all([
    general.rawResponse && general.section.retrievedAt
      ? saveMgbiArchive(organizationId, request.identifier.value, "pl-krs-wp-record",
        general.rawResponse.pages, general.rawResponse.recordCount, general.section.retrievedAt, lookup.requestId)
      : Promise.resolve(),
    financial.rawResponse && financial.section.retrievedAt
      ? saveMgbiArchive(organizationId, request.identifier.value, "pl-krs-rdf-record",
        financial.rawResponse.pages, financial.rawResponse.recordCount, financial.section.retrievedAt, lookup.requestId).then(() => saveFinancialDocuments(organizationId, request.identifier.value, financial.rawResponse!.pages))
      : Promise.resolve(),
  ]));
  if (!isCompanyReportRestricted(general.section.data) && financial.rawResponse)
    financial = await atLookupStage("financial_persistence", () => enrichMsrFinancial(organizationId,request.identifier.value,financial,{requestId:lookup.requestId,allowedKrs:general.section.data?.registryHistory?.members.map(m=>m.krs)}),"financial");
  if (!isCompanyReportRestricted(general.section.data) && financial.section.data) {
    const documents=await readFinancialDocuments(organizationId,request.identifier.value);
    financial.section=applyFinancialDocumentMetadata(financial.section,documents,general.section.data?.registryHistory);
    if(financial.sourceData) financial.sourceData=applyFinancialDocumentMetadata({...financial.section,data:financial.sourceData},documents,general.section.data?.registryHistory).data ?? undefined;
  }
  const generalSnapshotId = await persistSection(organizationId, lookup, "general", general.section, general.errorCode);
  const financialSnapshotId = isCompanyReportRestricted(general.section.data) ? null : await persistSection(organizationId, lookup, "financial", financial.section, financial.errorCode, financial.facts, undefined, financial.sourceData);
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

export async function runXrayKysLookup(organizationId: string, request: XrayLookupRequest, entityType: "COMPANY" | "JDG" = "COMPANY", signal?: AbortSignal): Promise<{ section: SupplierXRayCard["kys"]; snapshotId: string | null }> {
  if (isRestrictedRegistrationStatus(await readSupplierRegistrationStatus(organizationId, request.identifier.value, entityType)))
    return { section: emptyCard.kys, snapshotId: null };
  await atLookupStage("retention_cleanup", () => Promise.all([purgeExpiredKysPersonal(organizationId), purgeExpiredSharedKys(organizationId)]), "kys");
  const lookup = await atLookupStage("lookup_registration", () => createLookup(organizationId, request.identifier, entityType));
  const result = await getOrFetchKys(organizationId, request.identifier.value, entityType,
    () => atLookupStage("provider_retrieval", () => fetchVerclyKys({ identifier: request.identifier }, { signal }), "kys"),
    (section, errorCode, correlationId, method) =>
      persistSection(organizationId, lookup, "kys", section, errorCode, [], correlationId, undefined, method),
    { signal },
  );
  return { section: result.section, snapshotId: result.snapshotId };
}
