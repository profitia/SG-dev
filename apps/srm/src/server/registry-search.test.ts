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
  return { ...emptyCard, identity: { krs: companyNip ? "0000217580" : null, nip: companyNip, name: companyNip ? "Test Spółka" : null }, general: {
    ...emptyCard.general, status,
    data: companyNip ? { legalName: "Test Spółka", legalForm: null, krs: "0000217580", nip: companyNip,
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

test("a current known company opens without any CEIDG invocation", async () => {
  let jdgCalls = 0;
  let companyCalls = 0;
  const result = await searchRegistryByNip("org", request, {
    catalog: async () => true,
    jdg: async () => { jdgCalls += 1; return jdg("EMPTY"); },
    company: async () => { companyCalls += 1; return company("SUCCESS", nip); },
  });
  assert.equal(result.entityType, "COMPANY");
  assert.equal(jdgCalls, 0);
  assert.equal(companyCalls, 1);
});

test("missing from both registries is distinct from provider failure", async () => {
  const notFound = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("EMPTY"), company: async () => company("EMPTY"),
  });
  const unavailable = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("ERROR"), company: async () => company("EMPTY"),
  });
  assert.equal(notFound.entityType, "NOT_FOUND");
  assert.deepEqual(unavailable, { entityType: "UNAVAILABLE", unavailableProvider: "CEIDG" });
});

test("a company provider failure is not reported as CEIDG unavailability", async () => {
  const result = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("EMPTY"), company: async () => company("ERROR"),
  });
  assert.deepEqual(result, { entityType: "UNAVAILABLE", unavailableProvider: null });
});

test("CEIDG failure can be resolved only by independently verified MGBI identity", async () => {
  const result = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("ERROR"), company: async () => company("SUCCESS", nip),
  });
  assert.equal(result.entityType, "COMPANY");
});

test("unknown or expired catalog proof checks CEIDG before MGBI exactly once", async () => {
  const calls: string[] = [];
  const result = await searchRegistryByNip("org", request, {
    catalog: async (org, selected) => { assert.equal(org,"org"); assert.equal(selected,nip); calls.push("catalog"); return false; },
    jdg: async () => { calls.push("ceidg"); return jdg("EMPTY"); },
    company: async () => { calls.push("mgbi"); return company("SUCCESS",nip); },
  });
  assert.equal(result.entityType,"COMPANY"); assert.deepEqual(calls,["catalog","ceidg","mgbi"]);
});

test("known company whose result changes or fails is not acquired twice or reclassified", async () => {
  for (const card of [company("ERROR"),company("SUCCESS","5272443955")]) {
    let calls=0;
    const result=await searchRegistryByNip("org",request,{
      catalog:async()=>true, jdg:async()=>{throw Error("No reclassification");},
      company:async()=>{calls++;return card;},
    });
    assert.deepEqual(result,{entityType:"UNAVAILABLE",unavailableProvider:null}); assert.equal(calls,1);
  }
});

test("incomplete, mismatched and conflicting company identities are never published", async () => {
  const valid=company("SUCCESS",nip);
  for(const change of [
    (v:SupplierXRayCard)=>{v.identity.nip="5272443955";},
    (v:SupplierXRayCard)=>{v.identity.krs="0000000001";},
    (v:SupplierXRayCard)=>{v.identity.name="Another company";},
    (v:SupplierXRayCard)=>{v.general.data!.krs=null;},
    (v:SupplierXRayCard)=>{v.general.data!.legalName="";},
    (v:SupplierXRayCard)=>{v.general.data!.registryHistory={version:"KRS_CONTINUITY_V1",currentKrs:"0000000001",members:[],links:[],unlinkedKrs:[]};},
  ]){
    const card=structuredClone(valid);change(card);
    for(const status of ["EMPTY","ERROR"] as const){
      const result=await searchRegistryByNip("org",request,{jdg:async()=>jdg(status),company:async()=>card});
      assert.equal(result.entityType,"UNAVAILABLE");
    }
  }
});

test("CEIDG unavailability and absence remain distinct for every unsuccessful MGBI outcome",async()=>{
  for(const status of ["ERROR","EMPTY","PENDING","NOT_REQUESTED"] as const){
    const result=await searchRegistryByNip("org",request,{jdg:async()=>jdg("ERROR"),company:async()=>company(status)});
    assert.deepEqual(result,{entityType:"UNAVAILABLE",unavailableProvider:"CEIDG"});
  }
});

test("incomplete or conflicting CEIDG success never becomes absence or a company acquisition",async()=>{
  for(const status of ["SUCCESS","PARTIAL"] as const){
    for(const section of [jdg(status),{...jdg(status,true),data:{entries:[{...jdg(status,true).data!.entries[0],nip:"5272443955"}]}}]){
      const result=await searchRegistryByNip("org",request,{jdg:async()=>section,company:async()=>{throw Error("No MGBI after identity conflict");}});
      assert.deepEqual(result,{entityType:"UNAVAILABLE",unavailableProvider:"CEIDG"});
    }
  }
});

test("authorization, audit and catalog failures propagate without provider fallback",async()=>{
  const denied=Error("Synthetic protected catalog refusal");
  await assert.rejects(searchRegistryByNip("org",request,{
    catalog:async()=>{throw denied;},jdg:async()=>{throw Error("No CEIDG fallback");},company:async()=>{throw Error("No MGBI fallback");},
  }),error=>error===denied);
});

test("historical removal evidence preserves the existing withheld-report notice without admitting incomplete identity or finances",async()=>{
  const removed=company("PARTIAL",nip);
  removed.identity.krs=null;removed.identity.name=null;
  removed.general.data!.krs=null;removed.general.data!.legalName=null;
  removed.general.data!.registrationStatus="DEREGISTERED";
  const result=await searchRegistryByNip("org",request,{jdg:async()=>jdg("EMPTY"),company:async()=>removed});
  assert.equal(result.entityType,"COMPANY");
  assert.equal(result.entityType==="COMPANY"&&result.card.financial.status,"NOT_REQUESTED");
  for(const unsafe of [
    {...removed,financial:{...removed.financial,status:"SUCCESS" as const}},
    {...removed,general:{...removed.general,data:{...removed.general.data!,registrationStatus:"UNKNOWN" as const}}},
  ]) assert.equal((await searchRegistryByNip("org",request,{jdg:async()=>jdg("EMPTY"),company:async()=>unsafe})).entityType,"UNAVAILABLE");
  assert.deepEqual(await searchRegistryByNip("org",request,{jdg:async()=>jdg("ERROR"),company:async()=>removed}),{entityType:"UNAVAILABLE",unavailableProvider:"CEIDG"});
});

test("a mismatched company identifier cannot select a company", async () => {
  const result = await searchRegistryByNip("org", request, {
    jdg: async () => jdg("EMPTY"), company: async () => company("SUCCESS", "5272443955"),
  });
  assert.deepEqual(result, { entityType: "UNAVAILABLE", unavailableProvider: null });
});
