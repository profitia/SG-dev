export type SectionStatus =
  | "SUCCESS"
  | "EMPTY"
  | "PARTIAL"
  | "ERROR"
  | "NOT_REQUESTED"
  | "PENDING";

export type SupplierIdentity = {
  krs: string | null;
  nip: string | null;
  name: string | null;
};

export type SourceProvenance = {
  provider: "MGBI" | "VERCLY" | "CEIDG";
  model: string;
  recordId: string | null;
};

export type SectionEnvelope<T> = {
  status: SectionStatus;
  source: SourceProvenance;
  retrievedAt: string | null;
  effectiveAt: string | null;
  data: T | null;
  warnings: readonly string[];
};

export type GeneralCompanyData = {
  /** Historical projections may omit status; missing fields never prove removal. */
  registrationStatus?: "ACTIVE" | "LIQUIDATION" | "DEREGISTERED" | "UNKNOWN";
  deregisteredAt?: string | null;
  legalName: string | null;
  legalForm: string | null;
  krs: string | null;
  nip: string | null;
  regon: string | null;
  registeredAddress: string | null;
  registeredAt: string | null;
  mainPkd: string | null;
  /** Description from the same current MGBI primary activity; absent in legacy records. */
  mainPkdDescription?: string | null;
  /** Optional current registry hint; not yet a verified website. */
  website?: string | null;
};

export type FinancialPeriod = {
  effectiveRevisionId?: string;
  revisionStatus?: "RESOLVED" | "UNRESOLVED";
  accountingStandard?: "POLISH_UOR" | "IAS_IFRS" | "UNKNOWN";
  accountingStandardBasis?: string;
  isIasCompliant?: boolean | null;
  xmlSchema?: { name: string | null; version: string | null };
  /** Numeric, person-free statement positions; raw notes and original files stay tenant-only. */
  msrRows?: readonly {
    key: string; label: string; section: "Bilans" | "RZiS" | "CashFlow" | "Equity" | "ComprehensiveIncome" | "Other";
    amount: string | null; currency: string | null; unit: string; validation: "VALID" | "REVIEW";
    dimensions: readonly string[];
  }[];
  from: string;
  to: string;
  scope: "standalone" | "consolidated";
  documentId: string;
  facts: readonly {
    metricCode: string;
    amount: string;
    currency: string;
    unit: string;
  }[];
};

export type FinancialIndicatorResult = {
  code: string;
  periodStart: string;
  periodEnd: string;
  scope: FinancialPeriod["scope"];
  status: "AVAILABLE" | "UNAVAILABLE";
  value: string | null;
  unit: "RATIO" | "PERCENT" | "PLN" | "DAYS";
  importance: 1 | 2 | 3;
  reasonCode: string | null;
  formulaVersion: string;
};

export type FinancialData = {
  revisionRule?: string;
  periods: readonly FinancialPeriod[];
  indicators?: readonly FinancialIndicatorResult[];
};

/** Stored-report read contract; it never requests or refreshes a provider. */
export type ReportFreshness = {
  retrievedAt: string | null;
  checkedAt: string | null;
  cacheExpiresAt: string | null;
  retentionUntil: string | null;
  freshness: "FRESH" | "EXPIRED" | "UNKNOWN" | "ABSENT";
  readSource: "STORED";
  lastRetrievalMethod: "PROVIDER" | "CACHE" | "UNKNOWN";
};

export type FinancialFactEvidence = {
  ref: string;
  documentRef: string;
  metricCode: string;
  periodStart: string;
  periodEnd: string;
  scope: FinancialPeriod["scope"];
  amount: string;
  sourceAmount: string | null;
  currency: string;
  unit: string;
  validation: "VERIFIED" | "UNVERIFIED" | "UNAVAILABLE";
  normalization: "NORMALIZED_CONFIRMED" | "SOURCE_VALUE" | "SOURCE_UNCONFIRMED" | "UNKNOWN";
  normalizationRule: string | null;
  reasonCode: string | null;
};

export type FinancialHistoryPoint = FinancialIndicatorResult & {
  year: string;
  documentRef: string;
  definitionRef: { code: string; formulaVersion: string };
  evidence: readonly FinancialFactEvidence[];
  comparison: {
    status: "COMPARABLE" | "NOT_COMPARABLE" | "UNKNOWN";
    reasonCode: string | null;
    previousPeriod: { from: string; to: string } | null;
    delta: string | null;
    unit: "PERCENTAGE_POINTS" | "RATIO" | "PLN" | "DAYS";
    direction: "UP" | "DOWN" | "UNCHANGED" | "NO_COMPARISON";
  };
};

export type ScannerAxisCode = "NET_RESULT" | "REVENUE" | "CURRENT_RATIO" | "OPERATING_MARGIN" | "OPERATING_COST_RATIO" | "LIABILITIES_TO_ASSETS";
/** Server-owned scoring over qualified source observations; no client-side financial formulas. */
export type FinancialScannerProjection = {
  version: "1.0" | "1.1"; methodologyVersion: "1.0.0" | "2.0.0" | "3.0.0" | "4.0.0"; qualification: "PARTIAL_SOURCE_VIEW" | "QUALIFIED_HISTORY";
  sourceVersion: string | null;
  referenceFrames?: readonly {
    id: string; scope: FinancialPeriod["scope"]; anchorPeriodId: string; asOf: string;
    qualificationRule: "XML_SOURCE_BASIS_V1" | "XML_SOURCE_BASIS_V2" | "FINANCIAL_SOURCE_BASIS_V3";
    axes: readonly { code: ScannerAxisCode; periodIds: readonly string[]; bestValue: string | null;
      worstValue: string | null; bestPeriodIds: readonly string[]; basisKey: string | null }[];
  }[];
  periods: readonly {
    id: string; from: string; to: string; scope: FinancialPeriod["scope"]; documentRef: string;
    referenceFrameId?: string;
    axes: readonly {
      code: ScannerAxisCode; rawValue: string | null; unit: "PLN" | "PERCENT" | "RATIO";
      normalizedScore: string | null; basis: "POLICY" | "HISTORICAL_BEST";
      reasonCode: string | null; alerts: readonly string[];
      tone: "positive" | "caution" | "negative" | "unknown";
      qualification?: "VERIFIED" | "UNKNOWN" | "NOT_COMPARABLE";
      sourceEvidenceRef?: string | null;
      comparisons?: readonly { periodId: string; delta: string; deltaPercent: string | null;
        direction: "UP" | "DOWN" | "UNCHANGED"; favorable: "BETTER" | "WORSE" | "UNCHANGED";
      }[];
    }[];
  }[];
};
export type SupplierReportData = {
  schemaVersion: "1.0";
  /** Opaque authenticated organization/session preference namespace; never data authority. */
  preferenceScope?: string;
  nip: string;
  entityType: "COMPANY" | "JDG";
  financial: {
    status: SectionStatus;
    source: "MGBI";
    freshness: ReportFreshness;
    completeness: "COMPLETE" | "PARTIAL" | "EMPTY" | "UNKNOWN";
    limitations: readonly string[];
    mappingVersion: string | null;
    /** Opaque content identities, never database snapshot or tenant IDs. */
    sourceVersion: string | null;
    scanner?: FinancialScannerProjection;
    representationVersion: string | null;
    periods: readonly {
      from: string; to: string; year: string; scope: FinancialPeriod["scope"];
      accountingStandard?: FinancialPeriod["accountingStandard"];
      documentRef: string; facts: readonly FinancialFactEvidence[];
    }[];
    history: readonly { code: string; reasonCode: string | null; points: readonly FinancialHistoryPoint[] }[];
  };
  kys: {
    status: SectionStatus;
    source: "VERCLY";
    freshness: ReportFreshness;
    completeness: "COMPLETE" | "PARTIAL" | "EMPTY" | "UNKNOWN";
    lastAttemptStatus: "PENDING" | "SUCCESS" | "NO_DATA" | "TIMEOUT" | "ERROR" | null;
    lastAttemptAt: string | null;
    limitations: readonly string[];
    /** Metadata only: an expired report's projection/person data is never returned. */
    reportAvailable: boolean;
    /** Opaque organization/supplier/snapshot binding for an authorized stored PDF; never a database ID. */
    exportRef?: string | null;
  };
};

export type JdgField = {
  key: string;
  label: string;
  value: string | null;
  children: readonly JdgField[];
};

export type JdgEntry = {
  recordId: string;
  name: string;
  status: string | null;
  nip: string;
  regon: string | null;
  fields: readonly JdgField[];
};

export type JdgRegistryData = { entries: readonly JdgEntry[] };

export type VerclyPerson = {
  fullName: string;
  pesel: string | null;
  peselRevealToken?: string | null;
  birthDate: string | null;
  positions: readonly string[];
  citizenship: readonly string[];
  foundIn: readonly string[];
  sanctionsMatch: boolean | null;
  pepMatch: boolean | null;
};

export type VerclyPepMatch = {
  personGroup: "beneficialOwners" | "relatedPersons";
  personIndex: number;
  personName: string;
  searchPhrase: string | null;
  matchedName: string | null;
  aliases: readonly string[];
  birthDate: string | null;
  positions: readonly string[];
  probabilityPercent: number | null;
  identifierMatchesPesel: boolean;
};

export type VerclyKysData = {
  correlationId: string | null;
  reportId: string | null;
  isComplete: boolean;
  queriedRegisters: readonly string[];
  registryChecks?: {
    krzListed: boolean | null;
    vatActive: boolean | null;
    euVat: boolean | null;
  };
  stateAsOf: string | null;
  company?: {
    name: string | null;
    krs: string | null;
    nip: string | null;
    regon: string | null;
    legalForm: string | null;
    address: string | null;
    country: string | null;
    activityStatus: string | null;
    registeredAt: string | null;
    lastChangedAt: string | null;
    mainPkd: string | null;
    shareCapital: string | null;
    representation: string | null;
    district?: string | null;
    municipality?: string | null;
    voivodship?: string | null;
    headquarterCountry?: string | null;
    createdAt?: string | null;
    commencedAt?: string | null;
    registerAuthority?: string | null;
    ownershipForm?: string | null;
    phone?: string | null;
  };
  screenedLists?: readonly { name: string; type: string; matched: boolean }[];
  screeningSummary?: {
    directlyRelatedSanctions: boolean | null;
    beneficiaryRelatedSanctions: boolean | null;
    otherLists: boolean | null;
  };
  relatedEntities?: readonly {
    name: string;
    role: string | null;
    krs: string | null;
    nip: string | null;
    regon: string | null;
    relationshipStart: string | null;
    relationshipEnd: string | null;
    stakeDescription: string | null;
    sanctionsMatch: boolean | null;
  }[];
  beneficialOwners?: readonly VerclyPerson[];
  relatedPersons?: readonly VerclyPerson[];
  beneficialOwnersCount?: number | null;
  relatedPersonsCount?: number | null;
  pepPositionsCount?: number | null;
  /** Normalized person-level PEP evidence; presence also identifies the current KYS projection. */
  pepMatches?: readonly VerclyPepMatch[];
  riskLevel?: string | null;
};

export type SupplierXRayCard = {
  identity: SupplierIdentity;
  general: SectionEnvelope<GeneralCompanyData>;
  financial: SectionEnvelope<FinancialData>;
  kys: SectionEnvelope<VerclyKysData>;
};

/** Independent website enrichment; no financial scores or provider payloads. */
export type SupplierWebIdentityData = {
  status: "FOUND" | "NOT_FOUND" | "UNAVAILABLE" | "PENDING";
  websiteUrl: string | null;
  logoDataUrl: string | null;
  evidenceUrl: string | null;
  logoSourceUrl: string | null;
  method: "REGISTRY_AND_WEBSITE" | "WEBSITE_IDENTITY" | null;
  checkedAt: string | null;
};
