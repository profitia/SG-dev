import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPLIER_PIPELINES_CONTRACT_ID,SUPPLIER_PIPELINES_CONTRACT_VERSION,SupplierPipelinesContract,ADP_UI_CONTRACT_VERSION} from '../src/index';
import {readFileSync} from 'node:fs';
test('public producer exports a separately versioned transport-free domain contract',()=>{
 assert.equal(SUPPLIER_PIPELINES_CONTRACT_ID,'srm.supplier-pipelines');
 assert.equal(SUPPLIER_PIPELINES_CONTRACT_VERSION,'1.0.0');
 assert.equal(SupplierPipelinesContract.SUPPLIER_PIPELINES_CONTRACT_VERSION,'1.0.0');
 assert.equal(ADP_UI_CONTRACT_VERSION,'1.0.0');
 const manifest=JSON.parse(readFileSync(new URL('../source-contract.json',import.meta.url),'utf8'));
 assert.equal(manifest.contractVersion,'1.0.0');assert.equal(manifest.scope,'PRESENTATION_ONLY');
 assert.equal(manifest.domainContracts[0].contractId,'srm.supplier-pipelines');
 assert.equal(manifest.domainContracts[0].status,'SOURCE_CANDIDATE_UNADOPTED');
});
test('domain DTOs can represent legacy master identity, independent processes and unknown ADP',()=>{
 const card:SupplierPipelinesContract.SupplierCard={
  supplierId:'stable-id',nipNormalized:null,displayName:'Legacy KRS',contacts:[],
  relationshipOwner:null,cardCategories:[],memberships:[],adp:{status:'UNKNOWN',projectionVersion:1},
  lifecycle:'ACTIVE',version:0,updatedAt:'2026-11-19T12:00:00Z',
 };
 assert.equal(card.version,0);assert.equal(card.adp.status,'UNKNOWN');
});
