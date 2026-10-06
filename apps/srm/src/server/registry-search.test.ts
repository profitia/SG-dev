import assert from "node:assert/strict";
import test from "node:test";
import type { JdgRegistryData, SectionEnvelope, SupplierXRayCard } from "@profitia/srm-xray";
import { emptyCard } from "../demo/fixture";
import { searchRegistryByNip } from "./registry-search";

const nip = "7972088368";
const request = { identifier: { type: "NIP" as const, value: nip } };

function jdg(status: SectionEnvelope<JdgRegistryData>["status"], hasEntry = false): SectionEnvelope<JdgRegistryData> {
  return {
    status, source: { provider: "CEIDG", model: "firma", recordId: null },
    retrievedAt: null, effectiveAt: null, warnings: [],
    data: hasEntry ? { entries: [{ recordId: "test", name: "Test JDG", status: "Aktywny", nip, regon: null, fields: [] }] } : null,
  };
}

function company(status: SupplierXRayCard["general"]["status"], companyNip: string | null = null): SupplierXRayCard {
  return { ...emptyCard, identity: { krs: null, nip: companyNip, name: null }, general: {
    ...emptyCard.general, status,
    data: companyNip ? { legalName: "Test Spółka", legalForm: null, krs: null, nip: companyNip,
      regon: null, registeredAddress: null, registeredAt: null, mainPkd: null } : null,
  } };
}

test("JDG match selects CEIDG without spending a company lookup", async () => {
  const result = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("SUCCESS", true),
    company: async () => { throw new Error("MGBI must not be called for JDG"); },
  });
  assert.equal(result.entityType, "JDG");
});

test("CEIDG empty falls through to a verified company", async () => {
  const result = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("EMPTY"), company: async () => company("PARTIAL", nip),
  });
  assert.equal(result.entityType, "COMPANY");
});

test("missing from both registries is distinct from provider failure", async () => {
  const notFound = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("EMPTY"), company: async () => company("EMPTY"),
  });
  const unavailable = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("ERROR"), company: async () => company("EMPTY"),
  });
  assert.equal(notFound.entityType, "NOT_FOUND");
  assert.equal(unavailable.entityType, "UNAVAILABLE");
});

test("company report can resolve a NIP when CEIDG is unavailable", async () => {
  const result = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("ERROR"), company: async () => company("SUCCESS", nip),
  });
  assert.equal(result.entityType, "COMPANY");
});

test("a mismatched company identifier cannot select a company", async () => {
  const result = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("EMPTY"), company: async () => company("SUCCESS", "5272443955"),
  });
  assert.equal(result.entityType, "UNAVAILABLE");
});
