import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG_FRESHNESS_MS, FINANCIAL_MAPPING_VERSION, catalogFreshnessMs, isCurrentFinancialMapping, isFreshCatalogEntry } from "./shared-catalog";

test("MGBI catalog reuses a valid check for seven days, then requires a refresh", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  assert.equal(CATALOG_FRESHNESS_MS, 168 * 60 * 60 * 1000);
  assert.equal(isFreshCatalogEntry(null, now), false);
  assert.equal(isFreshCatalogEntry("invalid", now), false);
  assert.equal(isFreshCatalogEntry(new Date(now.getTime() + 1), now), false);
  assert.equal(isFreshCatalogEntry(new Date(now.getTime() - CATALOG_FRESHNESS_MS + 1), now), true);
  assert.equal(isFreshCatalogEntry(new Date(now.getTime() - CATALOG_FRESHNESS_MS), now), false);
});

test("MGBI freshness can only be shortened and applies to already stored checks", () => {
  const hour = 60 * 60 * 1000;
  assert.equal(catalogFreshnessMs({ SRM_MGBI_CACHE_TTL_HOURS: "24" }), 24 * hour);
  assert.equal(catalogFreshnessMs({ SRM_MGBI_CACHE_TTL_HOURS: "" }), CATALOG_FRESHNESS_MS);
  for (const value of ["0", "169", "1.5", "invalid", "Infinity"]) {
    assert.throws(() => catalogFreshnessMs({ SRM_MGBI_CACHE_TTL_HOURS: value }), /SRM_MGBI_CACHE_TTL_HOURS/);
  }
  const now = new Date("2026-10-08T12:00:00Z");
  const checked = new Date(now.getTime() - 25 * hour);
  assert.equal(isFreshCatalogEntry(checked, now), true);
  assert.equal(isFreshCatalogEntry(checked, now, catalogFreshnessMs({ SRM_MGBI_CACHE_TTL_HOURS: "24" })), false);
});

test("financial cache requires the current source mapping", () => {
  assert.equal(isCurrentFinancialMapping(null), false);
  assert.equal(isCurrentFinancialMapping({} as never), false);
  assert.equal(isCurrentFinancialMapping({ catalogMappingVersion: "2026-10-07-extracted-v1" } as never), false);
  assert.equal(isCurrentFinancialMapping({ catalogMappingVersion: FINANCIAL_MAPPING_VERSION } as never), true);
});

import type { PoolClient } from 'pg';
import { writeSharedCompany, writeFinancialIndicators } from './shared-catalog';
import { mapMgbiFinancialRecords } from './mgbi-financial';
const NIP = '5272443955', PROOF = '40000000-0000-4000-8000-000000000001';

test('the single explicit catalog writer preserves legacy owner values and allows real global SOURCE lineage', async () => {
  const source = mapMgbiFinancialRecords([{id:'b'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:'0000217580'},
    document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31'},
    content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ca_cfy:'300',lae_lapfl_stl_cfy:'200'}}}}],
    {type:'NIP',value:NIP},'2026-10-19T00:00:00.000Z');
  const recorded: {sql:string;values:unknown[]}[] = [];
  const client = {query:async(sql:string,values:unknown[]=[])=>{recorded.push({sql,values});return {rows:[]}}} as unknown as Pick<PoolClient,'query'>;
  const input = {general:{...source.section,data:null},financial:source.section,generalSnapshotId:PROOF,financialSnapshotId:PROOF,facts:source.facts};
  const legacyOrg = '11111111-1111-4111-8111-111111111111';
  await writeSharedCompany(client, legacyOrg, NIP, input);
  const legacy = structuredClone(recorded); recorded.length=0;
  await writeSharedCompany(client, null, NIP, input);
  assert.equal(recorded.length, legacy.length);
  for(let i=0;i<recorded.length;i++)assert.equal(recorded[i].sql,legacy[i].sql);
  const facts = JSON.parse(String(recorded.at(-1)!.values[0]));
  const oldFacts = JSON.parse(String(legacy.at(-1)!.values[0]));
  assert(facts.length>0);
  for(let i=0;i<facts.length;i++){
    assert.equal(oldFacts[i].source_organization_id,legacyOrg);assert.equal(facts[i].source_organization_id,null);
    assert.equal(facts[i].source_snapshot_id,PROOF);
    assert.deepEqual({...facts[i],source_organization_id:legacyOrg},oldFacts[i]);
  }
});

test('explicit indicator writer uses original financial calculator and strips only public provenance', async () => {
  const mapped = mapMgbiFinancialRecords([{id:'b'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:'0000217580'},
    document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31'},
    content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ca_cfy:'300',lae_lapfl_stl_cfy:'200'}}}}],
    {type:'NIP',value:NIP},'2026-10-19T00:00:00.000Z');
  const facts=mapped.facts.map(f=>({...f,sourceSnapshotId:PROOF}));
  let persisted:any[]=[];
  const client={query:async(sql:string,values:unknown[]=[])=>{
    if(sql.startsWith('SELECT'))return {rows:facts};persisted=JSON.parse(String(values[0]));return {rows:[]};
  }} as unknown as Pick<PoolClient,'query'>;
  const result=await writeFinancialIndicators(client,NIP,mapped.section.data!);
  assert.equal(result.find(i=>i.code==='CURRENT_RATIO')!.value,'1.500000');
  assert.deepEqual(persisted.find(i=>i.indicator_code==='CURRENT_RATIO').source_snapshot_ids,[PROOF]);
  for(const row of result)for(const key of ['nip','inputFacts','sourceSnapshotIds','sourceDocumentIds'])assert.equal(Object.hasOwn(row,key),false);
});
