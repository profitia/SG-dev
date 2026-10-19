import type { DatabasePool } from "./db";
import { projectPublicFinancialData } from "./corporate-knowledge";
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
    data: section.source.provider === "MGBI" && ["pl-krs-rdf-record", "KRS-RDF"].includes(section.source.model)
      ? projectPublicFinancialData(section.data) as T | null : section.data,
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
  privateEnvelope = false,
): Promise<string | null> {
  if (privateEnvelope && sectionName !== "kys") throw new TypeError("Private KYS projection required");
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
        version: sectionName === "kys" ? 2 : 1, data: section.data,
        ...(privateEnvelope ? { privateEnvelope: section } : {}) }, pool), sectionName);
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

export async function fetchCompanyFinancial(data: SupplierXRayCard["general"]["data"], identifier: CompanyIdentifier, provider: typeof fetchMgbiFinancial = fetchMgbiFinancial, recoverProviderException: typeof providerExceptionCode = providerExceptionCode) {
  return isCompanyReportRestricted(data)
    ? { section: emptyCard.financial, facts: [], rawResponse: undefined, sourceData: undefined, errorCode: null }
    : await provider(identifier,{companyHistory:data?.registryHistory}).catch((error) => ({
      section: { ...emptyCard.financial, status: "ERROR" as const, retrievedAt: new Date().toISOString(), warnings: ["MGBI_NOT_CONFIGURED"] },
      facts: [], sourceData: undefined, rawResponse: undefined, errorCode: recoverProviderException(error),
    }));
}

/** Complete server-owned ports for the single existing corporate workflow.
 * These functions provide effects, not identity or access authority. A native
 * host must bind each port to its current admitted HUMAN/SOURCE operation.
 * Partial compositions never inherit a demo database or provider credential. */
export type XrayCompanyPorts = {
  createLookup: typeof createLookup;
  readFreshCompany: typeof readFreshCompany;
  readCompanyRegistration: typeof readCompanyRegistration;
  enrichCompanyPkd: typeof enrichCompanyPkd;
  persistSection: typeof persistSection;
  saveSharedCompany: typeof saveSharedCompany;
  reprojectFinancialArchive: typeof reprojectFinancialArchive;
  enrichMsrFinancial: typeof enrichMsrFinancial;
  fetchMgbiGeneral: typeof fetchMgbiGeneral;
  fetchMgbiFinancial: typeof fetchMgbiFinancial;
  saveMgbiArchive: typeof saveMgbiArchive;
  saveFinancialDocuments: typeof saveFinancialDocuments;
  readFinancialDocuments: typeof readFinancialDocuments;
  refreshFinancialIndicators: typeof refreshFinancialIndicators;
  recordInterest: typeof recordDemoInterest;
  recoverProviderException: typeof providerExceptionCode;
};
const legacyCompanyPorts: Readonly<XrayCompanyPorts> = Object.freeze({
  createLookup, readFreshCompany, readCompanyRegistration, enrichCompanyPkd, persistSection, saveSharedCompany, reprojectFinancialArchive, enrichMsrFinancial, fetchMgbiGeneral, fetchMgbiFinancial, saveMgbiArchive, saveFinancialDocuments, readFinancialDocuments, refreshFinancialIndicators,
  recordInterest: recordDemoInterest, recoverProviderException: providerExceptionCode,
});
const companyPortNames = Object.freeze(Object.keys(legacyCompanyPorts).sort());

/** Explicit composition only. Construction captures every function reference;
 * no mutable request, actor, lease or transaction is retained between calls. */
export function createXrayCompanyLookup(input: XrayCompanyPorts) {
  if (typeof window !== "undefined" || !input || Object.getPrototypeOf(input) !== Object.prototype
    || Object.keys(input).sort().join(",") !== companyPortNames.join(",")
    || Reflect.ownKeys(input).length !== companyPortNames.length
    || Object.values(Object.getOwnPropertyDescriptors(input)).some(d => !("value" in d) || typeof d.value !== "function")) {
    throw new TypeError("Complete explicit company report ports required");
  }
  const ports: Readonly<XrayCompanyPorts> = Object.freeze({ ...input });
  return async (organizationId: string, request: XrayLookupRequest): Promise<SupplierXRayCard> => {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(organizationId)
      || !request || Object.getPrototypeOf(request) !== Object.prototype || Object.keys(request).join(",") !== "identifier"
      || !request.identifier || Object.getPrototypeOf(request.identifier) !== Object.prototype
      || Object.keys(request.identifier).sort().join(",") !== "type,value" || request.identifier.type !== "NIP"
      || typeof request.identifier.value !== "string") throw new TypeError("Explicit company selection required");
    const captured = validateXrayRequest({identifier: request.identifier.value});
    Object.freeze(captured.identifier); Object.freeze(captured);
    return runCompanyLookup(ports, organizationId, captured);
  };
}

/** Existing callers retain their original dependencies and business behavior. */
export async function runXrayLookup(organizationId: string, request: XrayLookupRequest): Promise<SupplierXRayCard> {
  return runCompanyLookup(legacyCompanyPorts, organizationId, request);
}

async function runCompanyLookup(ports: Readonly<XrayCompanyPorts>, organizationId: string, request: XrayLookupRequest): Promise<SupplierXRayCard> {
  const lookup = await atLookupStage("lookup_registration", () => ports.createLookup(organizationId, request.identifier));
  const cached = await atLookupStage("cache_read", () => ports.readFreshCompany(organizationId, request.identifier.value));
  if (cached) {
    const registration = cached.general.data?.registryHistory ? {status:cached.general.data.registrationStatus,deregisteredAt:cached.general.data.deregisteredAt}
      : await ports.readCompanyRegistration(organizationId, request.identifier.value);
    const companyData = await ports.enrichCompanyPkd(organizationId, request.identifier.value, cached.general);
    const general = { ...cached.general, data: companyData && { ...companyData,
      registrationStatus: registration.status, deregisteredAt: registration.deregisteredAt } };
    const history=general.data?.registryHistory,allowedKrs=history?.members.map(m=>m.krs);
    // A fresh shared payload still needs this organisation/request's private
    // history. Publishing shared knowledge remains conditional on a change.
    const generalSnapshotId=await ports.persistSection(organizationId,lookup,"general",general,null,[],undefined,undefined,"CACHE");
    if (cached.generalReprojected) {
      await ports.saveSharedCompany(organizationId,request.identifier.value,{general,financial:cached.financial,generalSnapshotId,financialSnapshotId:null,facts:[]});
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
    const reconstructed = needsRevisionProjection || needsRegistryProjection || needsQualityProjection ? await ports.reprojectFinancialArchive(organizationId,request.identifier.value,history) : null;
    const msr = await atLookupStage("financial_persistence", () => ports.enrichMsrFinancial(organizationId,request.identifier.value,
      reconstructed ?? {section:cached.financial,facts:[],errorCode:null},{requestId:lookup.requestId,allowedKrs,refreshMetadata:async()=>{
        const latest=await ports.fetchMgbiFinancial(request.identifier,{companyHistory:history});
        if (!latest.rawResponse || !latest.section.retrievedAt) throw new Error("MSR_METADATA_REFRESH_FAILED");
        await ports.saveMgbiArchive(organizationId,request.identifier.value,"pl-krs-rdf-record",latest.rawResponse.pages,latest.rawResponse.recordCount,latest.section.retrievedAt,lookup.requestId);
        await ports.saveFinancialDocuments(organizationId,request.identifier.value,latest.rawResponse.pages);
      }}),"financial");
    const documents=await ports.readFinancialDocuments(organizationId,request.identifier.value);
    const savedFinancial = applyFinancialDocumentMetadata(msr.section,documents,history);
    const sourceData=msr.sourceData ? applyFinancialDocumentMetadata({...msr.section,data:msr.sourceData},documents,history).data ?? undefined : undefined;
    const financialSnapshotId = await ports.persistSection(organizationId,lookup,"financial",savedFinancial,msr.errorCode,msr.facts,undefined,sourceData,"CACHE");
    if (msr.msrChanged || reconstructed || JSON.stringify(savedFinancial)!==JSON.stringify(cached.financial)) {
      await ports.saveSharedCompany(organizationId,request.identifier.value,{general,financial:savedFinancial,generalSnapshotId:null,financialSnapshotId,facts:msr.facts,preserveGeneral:true});
    }
    const financial = savedFinancial.data
      ? { ...savedFinancial, data: { ...savedFinancial.data, indicators: await ports.refreshFinancialIndicators(organizationId, request.identifier.value, savedFinancial.data) } }
      : savedFinancial;
    await ports.recordInterest(organizationId, request.identifier.value);
    return {
      identity: {
        krs: cached.general.data?.krs ?? null,
        nip: cached.general.data?.nip ?? request.identifier.value,
        name: cached.general.data?.legalName ?? null,
      },
      general, financial, kys: emptyCard.kys,
    };
  }
  const general = await ports.fetchMgbiGeneral(request.identifier).catch((error) => ({
      section: { ...emptyCard.general, status: "ERROR" as const, retrievedAt: new Date().toISOString(), warnings: ["MGBI_NOT_CONFIGURED"] },
      rawRecord: null, rawResponse: undefined, errorCode: ports.recoverProviderException(error),
    }));
  if (general.errorCode === "COMPANY_IDENTITY_AMBIGUOUS") {
    logProviderOutcome("MGBI","general","ERROR",general.errorCode);
    throw new Error("MGBI_COMPANY_IDENTITY_AMBIGUOUS");
  }
  let financial = await fetchCompanyFinancial(general.section.data, request.identifier, ports.fetchMgbiFinancial, ports.recoverProviderException);
  logProviderOutcome("MGBI", "general", general.section.status, general.errorCode);
  if (!isCompanyReportRestricted(general.section.data)) logProviderOutcome("MGBI", "financial", financial.section.status, financial.errorCode);
  // Keep complete provider responses in a tenant-scoped store, separate from
  // the normalized, person-free catalog reused across organizations.
  await atLookupStage("source_archive", () => Promise.all([
    general.rawResponse && general.section.retrievedAt
      ? ports.saveMgbiArchive(organizationId, request.identifier.value, "pl-krs-wp-record",
        general.rawResponse.pages, general.rawResponse.recordCount, general.section.retrievedAt, lookup.requestId)
      : Promise.resolve(),
    financial.rawResponse && financial.section.retrievedAt
      ? ports.saveMgbiArchive(organizationId, request.identifier.value, "pl-krs-rdf-record",
        financial.rawResponse.pages, financial.rawResponse.recordCount, financial.section.retrievedAt, lookup.requestId).then(() => ports.saveFinancialDocuments(organizationId, request.identifier.value, financial.rawResponse!.pages))
      : Promise.resolve(),
  ]));
  if (!isCompanyReportRestricted(general.section.data) && financial.rawResponse)
    financial = await atLookupStage("financial_persistence", () => ports.enrichMsrFinancial(organizationId,request.identifier.value,financial,{requestId:lookup.requestId,allowedKrs:general.section.data?.registryHistory?.members.map(m=>m.krs)}),"financial");
  if (!isCompanyReportRestricted(general.section.data) && financial.section.data) {
    const documents=await ports.readFinancialDocuments(organizationId,request.identifier.value);
    financial.section=applyFinancialDocumentMetadata(financial.section,documents,general.section.data?.registryHistory);
    if(financial.sourceData) financial.sourceData=applyFinancialDocumentMetadata({...financial.section,data:financial.sourceData},documents,general.section.data?.registryHistory).data ?? undefined;
  }
  const generalSnapshotId = await ports.persistSection(organizationId, lookup, "general", general.section, general.errorCode);
  const financialSnapshotId = isCompanyReportRestricted(general.section.data) ? null : await ports.persistSection(organizationId, lookup, "financial", financial.section, financial.errorCode, financial.facts, undefined, financial.sourceData);
  await atLookupStage("catalog_persistence", () => ports.saveSharedCompany(organizationId, request.identifier.value, {
    general: general.section, financial: financial.section,
    generalSnapshotId, financialSnapshotId, facts: financial.facts,
  }));
  const financialWithIndicators = financial.section.data
    ? { ...financial.section, data: { ...financial.section.data, indicators: await ports.refreshFinancialIndicators(organizationId, request.identifier.value, financial.section.data) } }
    : financial.section;
  if (general.section.data?.nip === request.identifier.value) await ports.recordInterest(organizationId, request.identifier.value);

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

export type XrayKysPorts = {
  readSupplierRegistrationStatus: typeof readSupplierRegistrationStatus;
  purgeExpiredKysPersonal: typeof purgeExpiredKysPersonal;
  purgeExpiredSharedKys: typeof purgeExpiredSharedKys;
  createLookup: typeof createLookup;
  getOrFetchKys: typeof getOrFetchKys;
  fetchVerclyKys: typeof fetchVerclyKys;
  persistSection: typeof persistSection;
};
const legacyKysPorts: Readonly<XrayKysPorts> = Object.freeze({
  readSupplierRegistrationStatus, purgeExpiredKysPersonal, purgeExpiredSharedKys,
  createLookup, getOrFetchKys, fetchVerclyKys, persistSection,
});
const kysPortNames = Object.freeze(Object.keys(legacyKysPorts).sort());

/** Same original KYS orchestration and single-flight cache. The complete
 * composition supplies private persistence and a separately admitted client. */
export function createXrayKysLookup(input: XrayKysPorts) {
  if (typeof window !== "undefined" || !input || Object.getPrototypeOf(input) !== Object.prototype
    || Object.keys(input).sort().join(",") !== kysPortNames.join(",")
    || Reflect.ownKeys(input).length !== kysPortNames.length
    || Object.values(Object.getOwnPropertyDescriptors(input)).some(d => !("value" in d) || !d.enumerable || typeof d.value !== "function")) {
    throw new TypeError("Complete explicit KYS ports required");
  }
  const ports: Readonly<XrayKysPorts> = Object.freeze({ ...input });
  return async (organizationId: string, request: XrayLookupRequest, entityType: "COMPANY" | "JDG" = "COMPANY", signal?: AbortSignal) => {
    if (typeof organizationId !== "string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(organizationId)
      || !["COMPANY", "JDG"].includes(entityType)
      || !request || Object.getPrototypeOf(request) !== Object.prototype || Object.keys(request).join(",") !== "identifier"
      || Reflect.ownKeys(request).length !== 1
      || Object.values(Object.getOwnPropertyDescriptors(request)).some(d => !("value" in d) || !d.enumerable)
      || !request.identifier || Object.getPrototypeOf(request.identifier) !== Object.prototype
      || Object.keys(request.identifier).sort().join(",") !== "type,value" || Reflect.ownKeys(request.identifier).length !== 2
      || Object.values(Object.getOwnPropertyDescriptors(request.identifier)).some(d => !("value" in d) || !d.enumerable)
      || request.identifier.type !== "NIP" || typeof request.identifier.value !== "string") throw new TypeError("Explicit KYS selection required");
    const captured = validateXrayRequest({ identifier: request.identifier.value });
    Object.freeze(captured.identifier); Object.freeze(captured);
    return runKysLookup(ports, organizationId, captured, entityType, signal);
  };
}

export async function runXrayKysLookup(organizationId: string, request: XrayLookupRequest, entityType: "COMPANY" | "JDG" = "COMPANY", signal?: AbortSignal): Promise<{ section: SupplierXRayCard["kys"]; snapshotId: string | null }> {
  return runKysLookup(legacyKysPorts, organizationId, request, entityType, signal);
}

async function runKysLookup(ports: Readonly<XrayKysPorts>, organizationId: string, request: XrayLookupRequest, entityType: "COMPANY" | "JDG", signal?: AbortSignal): Promise<{ section: SupplierXRayCard["kys"]; snapshotId: string | null }> {
  if (isRestrictedRegistrationStatus(await ports.readSupplierRegistrationStatus(organizationId, request.identifier.value, entityType)))
    return { section: emptyCard.kys, snapshotId: null };
  await atLookupStage("retention_cleanup", () => Promise.all([ports.purgeExpiredKysPersonal(organizationId), ports.purgeExpiredSharedKys(organizationId)]), "kys");
  const lookup = await atLookupStage("lookup_registration", () => ports.createLookup(organizationId, request.identifier, entityType));
  const result = await ports.getOrFetchKys(organizationId, request.identifier.value, entityType,
    () => atLookupStage("provider_retrieval", () => ports.fetchVerclyKys({ identifier: request.identifier }, { signal }), "kys"),
    (section, errorCode, correlationId, method) =>
      ports.persistSection(organizationId, lookup, "kys", section, errorCode, [], correlationId, undefined, method),
    { signal },
  );
  return { section: result.section, snapshotId: result.snapshotId };
}
