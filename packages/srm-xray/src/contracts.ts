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
  legalName: string | null;
  legalForm: string | null;
  krs: string | null;
  nip: string | null;
  regon: string | null;
  registeredAddress: string | null;
  registeredAt: string | null;
  mainPkd: string | null;
};

export type FinancialPeriod = {
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

export type FinancialData = { periods: readonly FinancialPeriod[] };

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
  birthDate: string | null;
  positions: readonly string[];
  citizenship: readonly string[];
  foundIn: readonly string[];
  sanctionsMatch: boolean | null;
  pepMatch: boolean | null;
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
  riskLevel?: string | null;
};

export type SupplierXRayCard = {
  identity: SupplierIdentity;
  general: SectionEnvelope<GeneralCompanyData>;
  financial: SectionEnvelope<FinancialData>;
  kys: SectionEnvelope<VerclyKysData>;
};
