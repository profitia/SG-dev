import type {
  FinancialData,
  GeneralCompanyData,
  SectionEnvelope,
  SupplierXRayCard,
  VerclyKysData,
} from "@profitia/srm-xray";

export type IdentifierKind = "nip" | "krs";
export type DemoIdentifierResult =
  | { ok: true; kind: IdentifierKind; value: string }
  | { ok: false; error: string };

export function validateDemoIdentifier(kind: string, raw: string): DemoIdentifierResult {
  if (kind !== "nip" && kind !== "krs") {
    return { ok: false, error: "Wybierz NIP albo KRS." };
  }
  const value = raw.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(value)) {
    return { ok: false, error: "NIP i KRS muszą zawierać dokładnie 10 cyfr." };
  }
  return { ok: true, kind, value };
}

function empty<T>(provider: "MGBI" | "VERCLY", model: string): SectionEnvelope<T> {
  return {
    status: "NOT_REQUESTED",
    source: { provider, model, recordId: null },
    retrievedAt: null,
    effectiveAt: null,
    data: null,
    warnings: [],
  };
}

export const emptyCard: SupplierXRayCard = {
  identity: { krs: null, nip: null, name: null },
  general: empty<GeneralCompanyData>("MGBI", "KRS-WP"),
  financial: empty<FinancialData>("MGBI", "KRS-RDF"),
  kys: empty<VerclyKysData>("VERCLY", "KYS"),
};

const demoWarning = "Dane testowe Development. Nie pobrano ich z API.";

export const sampleCard: SupplierXRayCard = {
  identity: { krs: null, nip: null, name: "Przykład techniczny SRM" },
  general: {
    status: "SUCCESS",
    source: { provider: "MGBI", model: "D4_TEST_DOUBLE_KRS_WP", recordId: null },
    retrievedAt: null,
    effectiveAt: null,
    warnings: [demoWarning],
    data: {
      legalName: "Przykład techniczny SRM",
      legalForm: "spółka z ograniczoną odpowiedzialnością",
      krs: null,
      nip: null,
      regon: null,
      registeredAddress: "Adres testowy",
      registeredAt: null,
      mainPkd: null,
    },
  },
  financial: {
    status: "SUCCESS",
    source: { provider: "MGBI", model: "D4_TEST_DOUBLE_KRS_RDF", recordId: null },
    retrievedAt: null,
    effectiveAt: null,
    warnings: [demoWarning],
    data: {
      periods: [{
        from: "2024-01-01",
        to: "2024-12-31",
        scope: "standalone",
        documentId: "TEST_DOCUMENT",
        facts: [
          { metricCode: "REVENUE_TEST", amount: "1000000", currency: "PLN", unit: "PLN" },
          { metricCode: "NET_PROFIT_TEST", amount: "100000", currency: "PLN", unit: "PLN" },
        ],
      }],
    },
  },
  kys: {
    status: "SUCCESS",
    source: { provider: "VERCLY", model: "D4_TEST_DOUBLE_KYS", recordId: null },
    retrievedAt: null,
    effectiveAt: null,
    warnings: [demoWarning],
    data: {
      correlationId: "TEST_CORRELATION",
      reportId: "TEST_REPORT",
      isComplete: true,
      queriedRegisters: ["Rejestr testowy"],
      stateAsOf: null,
    },
  },
};
