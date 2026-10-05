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
  provider: "MGBI" | "VERCLY";
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

export type VerclyKysData = {
  correlationId: string | null;
  reportId: string | null;
  isComplete: boolean;
  queriedRegisters: readonly string[];
  stateAsOf: string | null;
};

export type SupplierXRayCard = {
  identity: SupplierIdentity;
  general: SectionEnvelope<GeneralCompanyData>;
  financial: SectionEnvelope<FinancialData>;
  kys: SectionEnvelope<VerclyKysData>;
};
