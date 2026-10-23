import test from 'node:test';
import assert from 'node:assert/strict';
import type {CompanySnapshot,VerifiedIdentityV1} from '@profitia/krs-registry-contracts';
import {createKrsNameSearch,type AcceptedKrsSelection,type KrsNamePorts} from './krs-name-search';
import {mapMgbiFinancialRecords} from './mgbi-financial';
import {reconcileKrsFinancial} from './krs-financial';
import {createSupplierSearchGateway} from '../modules/xray/supplier-search-gateway';
const at='2026-10-22T15:00:00.000Z',time=Date.parse(at),krs='0000000001',nip='5213390341';
async function selection():Promise<AcceptedKrsSelection>{
  const {canonical,sha256,identityDigest}=await import('@profitia/krs-registry-contracts');
  const facts={entityKey:'PL:KRS:'+krs,canonicalKrs:krs,officialName:'Synthetic Fixture Engineering',nip,regon:null,legalForm:'SP Z O O',state:'ACTIVE' as const,statusEvidence:'synthetic-only',registeredOn:null,removedOn:null,address:null,addressVersion:null,names:[],identifiers:[],historicalCandidates:[],history:{entries:[],legalForms:[],addresses:[]},missingFields:[],warnings:[]};
  const source={provider:'KRS' as const,register:'P' as const,extract:'CURRENT' as const,sourceRecordId:krs,sourceVersion:'synthetic-source-v1',normalizerVersion:'krs-normalizer/1.0.0',rawDigest:'a'.repeat(64),contentDigest:await sha256(canonical(facts)),sourceAsOfDate:null,entryNumber:null,retrievedAt:at,checkedAt:at};
  const evidenceRef='KRS:'+krs+':'+await sha256(canonical({sourceVersion:source.sourceVersion,rawDigest:source.rawDigest,retrievedAt:at}));
  const snapshot:CompanySnapshot={contract:'profitia.krs-registry',version:'1.0.0',...facts,source,evidenceRef};
  const identity:VerifiedIdentityV1={contract:'profitia.krs-company-identity',version:'1.0.0',status:'VERIFIED',selectedKrs:krs,identity:{entityKey:facts.entityKey,krs,nip,regon:null,officialName:facts.officialName},source,validity:{policy:'KRS_FINANCIAL_IDENTITY_FRESHNESS_V1',maxAgeSeconds:300,maxClockSkewSeconds:30,expiresAt:new Date(time+300000).toISOString()},evidenceRef,evidenceDigest:'0'.repeat(64),historicalCandidates:[]};
  identity.evidenceDigest=await identityDigest(identity);return {snapshot,identity};
}
function record(id='right',company=krs,companyNip=nip,amount='1000'){
  return {id,identifiers:{pl_krs:company,pl_nip:companyNip},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31'},content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ta_cfy:amount}}}};
}
async function fixture(records=[record()]){
  const selected=await selection(),calls={acquire:0,publish:0,verify:0,search:0},result=mapMgbiFinancialRecords(records,{type:'NIP',value:nip},at);
  result.rawResponse={pages:[{results:records}],recordCount:records.length};
  const ports:KrsNamePorts={now:()=>time,registry:{search:async()=>{calls.search++;return [{krs,name:selected.snapshot.officialName!,nip,locality:null}]},verify:async()=>{calls.verify++;return selected},readSelection:async()=>selected},financial:{acquire:async()=>{calls.acquire++;return result},publishEligible:async(_request,_identity,eligible)=>{calls.publish++;assert.ok(eligible.facts.every(f=>f.amount!=='999999'));return null}}};
  return {selected,calls,ports,result,request:new Request('https://srm.example/api/xray/krs/lookup')};
}
test('typing and verifying are independent pure operations with zero Financial effects',async()=>{
  const f=await fixture(),api=createKrsNameSearch(f.ports);
  assert.equal((await api.search(f.request,'Fi')).coverage,'PROGRESSIVE');
  const choice=await api.verify(f.request,krs);assert.equal(choice.selectionRef,f.selected.snapshot.evidenceRef);
  assert.deepEqual(f.calls,{acquire:0,publish:0,verify:1,search:1});
});
test('bounded licensed-document work returns only protected General and pending Financial without publication',async()=>{
 const f=await fixture();f.ports.financial.acquire=async()=>({...f.result,workPending:true});
 const result=await createKrsNameSearch(f.ports).lookup(f.request,f.selected.snapshot.evidenceRef,'fixture-pending-request-001');
 assert.equal(result.pending,true);assert.equal(result.result.card.general.data?.registrySource?.provider,'KRS');
 assert.equal(result.result.card.financial.status,'PENDING');assert.equal(result.result.card.financial.data,null);
 assert.equal(result.metadata,null);assert.equal(f.calls.publish,0);
});
test('name report composes KRS General and the existing RDF mapper once, without MGBI General',async()=>{
  const f=await fixture(),r=await createKrsNameSearch(f.ports).lookup(f.request,f.selected.snapshot.evidenceRef,'fixture-name-request-001');
  assert.equal(r.result.card.identity.krs,krs);assert.equal(r.result.card.general.data?.registrySource?.provider,'KRS');
  assert.equal(r.result.card.financial.data?.periods[0].facts[0].amount,'1000');
  assert.deepEqual(f.calls,{acquire:1,publish:1,verify:0,search:0});
});
test('same NIP or same name does not admit another KRS document or its derived values',async()=>{
  const f=await fixture([record('foreign','0000000002',nip,'999999'),record()]);
  const r=await createKrsNameSearch(f.ports).lookup(f.request,f.selected.snapshot.evidenceRef,'fixture-name-request-002');
  assert.equal(r.result.card.financial.data?.periods[0].facts[0].amount,'1000');
  assert.ok(r.result.card.financial.warnings.includes('MGBI_FOREIGN_DOCUMENTS_EXCLUDED'));
  assert.doesNotMatch(JSON.stringify(r),/999999/);
});
test('company mismatch leaves valid General and excludes the entire Financial batch',async()=>{
  const f=await fixture([record('foreign','0000000002',nip,'999999')]);
  const r=await createKrsNameSearch(f.ports).lookup(f.request,f.selected.snapshot.evidenceRef,'fixture-name-request-003');
  assert.ok(r.result.card.general.data);assert.equal(r.result.card.financial.data,null);assert.equal(f.calls.publish,0);
});
test('missing returned NIP cannot adopt documents even with the same KRS',async()=>{
  const f=await fixture([record('missing',krs,'','999999')]);
  assert.equal((await reconcileKrsFinancial(f.selected.identity,f.result,time)).section.data,null);
});
test('identity reconciliation retains enriched Financial data, source periods and facts when all original records are eligible',async()=>{
 const f=await fixture();
 const period={...f.result.section.data!.periods[0],accountingStandard:'IAS_IFRS' as const,
  documentId:'right:cfy',facts:[{metricCode:'PALA_NRFS',amount:'1200',currency:'PLN',unit:'PLN' as const}]};
 const enriched={...f.result.section.data!,periods:[period]};f.result.sourceData=enriched;
 f.result.section={...f.result.section,data:enriched};
 const result=await reconcileKrsFinancial(f.selected.identity,f.result,time);
 assert.deepEqual(result.section.data?.periods[0].facts,period.facts);
 assert.deepEqual(result.sourceData?.periods[0].facts,period.facts);
 assert.equal(result.section.data?.periods[0].accountingStandard,'IAS_IFRS');
 assert.equal(result.facts,f.result.facts);assert.equal(result.rawResponse,f.result.rawResponse);
 assert.equal(result.section.data?.periods[0].sourceRegistration?.krs,krs);
});
for(const mutation of ['stale','forged','missing-nip','substituted-krs','unsupported'] as const)test('rejected '+mutation+' identity has zero Financial effects',async()=>{
  const f=await fixture();
  if(mutation==='stale')f.ports={...f.ports,now:()=>time+300001};
  else if(mutation==='forged')f.selected.identity.evidenceDigest='b'.repeat(64);
  else if(mutation==='missing-nip')f.selected.identity.identity.nip='';
  else if(mutation==='substituted-krs')f.selected.identity.selectedKrs='0000000002';
  else f.selected.identity.version='2.0.0' as '1.0.0';
  await assert.rejects(()=>createKrsNameSearch(f.ports).lookup(f.request,f.selected.snapshot.evidenceRef,'fixture-name-request-004'));
  assert.equal(f.calls.acquire,0);assert.equal(f.calls.publish,0);
});
test('financial unavailability and failed publication never replace General or disclose unaccepted numbers',async()=>{
  const f=await fixture();f.ports={...f.ports,financial:{...f.ports.financial,publishEligible:async()=>{throw Error('AUDIT_UNAVAILABLE')}}};
  const r=await createKrsNameSearch(f.ports).lookup(f.request,f.selected.snapshot.evidenceRef,'fixture-name-request-005');
  assert.equal(r.result.card.financial.data,null);assert.ok(r.result.card.general.data);
});
test('revocation before final projection denies the response',async()=>{
  const f=await fixture();let reads=0;
  f.ports={...f.ports,registry:{...f.ports.registry,readSelection:async()=>{if(++reads>=3)throw Error('ACCESS_REVOKED');return f.selected}}};
  await assert.rejects(()=>createKrsNameSearch(f.ports).lookup(f.request,f.selected.snapshot.evidenceRef,'fixture-name-request-006'),/ACCESS_REVOKED/);
});
test('client gateway never sends actor, organisation or identity DTO and refuses forged response shapes',async()=>{
  const calls:{url:string;body:unknown}[]=[];
  const gateway=createSupplierSearchGateway(async(url,init)=>{calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):null});
    return Response.json(String(url).endsWith('search')?{candidates:[],coverage:'PROGRESSIVE'}:{krs,name:'Synthetic',nip,locality:null,selectionRef:'KRS:'+krs+':'+ 'a'.repeat(64),organisationId:'forged'});
  });
  await gateway.search('Fixture',new AbortController().signal);
  await assert.rejects(()=>gateway.verify(krs,new AbortController().signal));
  assert.deepEqual(calls.map(c=>c.body),[{query:'Fixture'},{krs}]);
});


test('verified transformation chain keeps the current company and each original financial issuer',async()=>{
 const old='0000065856',middle='0001102066',history={version:'KRS_CONTINUITY_V1' as const,currentKrs:krs,
  members:[{krs,legalName:'Synthetic current',legalForm:null,status:'ACTIVE' as const,registeredAt:'2026-04-01',deregisteredAt:null},
   {krs:middle,legalName:'Synthetic predecessor SA',legalForm:null,status:'DEREGISTERED' as const,registeredAt:'2024-05-02',deregisteredAt:'2026-05-12'},
   {krs:old,legalName:'Synthetic oldest',legalForm:null,status:'DEREGISTERED' as const,registeredAt:'2001-12-03',deregisteredAt:'2024-06-04'}],
  links:[{predecessorKrs:middle,successorKrs:krs,basis:'KRS_FORMATION_TRANSFORMATION' as const},{predecessorKrs:old,successorKrs:middle,basis:'KRS_FORMATION_TRANSFORMATION' as const}],unlinkedKrs:[]};
 const older=record('old',old,nip,'500');older.document.period_from_date='2022-01-01';older.document.period_to_date='2022-12-31';
 const rows=[record('middle',middle),older],f=await fixture(rows);
 f.result=mapMgbiFinancialRecords(rows,{type:'NIP',value:nip},at,rows.length,history);f.result.rawResponse={pages:[{results:rows}],recordCount:rows.length};
 f.ports.registry.history=async()=>history;f.ports.financial.acquire=async(_request,_identity,_key,general)=>{assert.equal(general?.data?.registryHistory,history);return f.result};
 const r=await createKrsNameSearch(f.ports).lookup(f.request,f.selected.snapshot.evidenceRef,'fixture-history-request-001');
 assert.equal(r.result.card.identity.krs,krs);assert.equal(r.result.card.general.data?.registryHistory?.currentKrs,krs);
 assert.deepEqual(r.result.card.financial.data?.periods.map(p=>[p.to,p.sourceRegistration?.krs,p.sourceRegistration?.relationship]),[['2025-12-31',middle,'PREDECESSOR'],['2022-12-31',old,'PREDECESSOR']]);
 const foreign=record('foreign','0000099999',nip,'999999'),mixed={...f.result,rawResponse:{pages:[{results:[...rows,foreign]}],recordCount:3}};
 const reconciled=await reconcileKrsFinancial(f.selected.identity,mixed,time,history);
 assert.doesNotMatch(JSON.stringify(reconciled),/999999/);assert.equal(reconciled.section.data?.periods.length,2);
 assert.equal((await reconcileKrsFinancial(f.selected.identity,f.result,time)).errorCode,'FINANCIAL_COMPANY_MISMATCH');
});
test('unavailable or revoked continuity makes zero paid Financial calls and preserves registry General',async()=>{
 const f=await fixture();f.ports.registry.history=async()=>{throw Error('KRS_CONTINUITY_UNVERIFIED')};
 const r=await createKrsNameSearch(f.ports).lookup(f.request,f.selected.snapshot.evidenceRef,'fixture-history-denied-001');
 assert.equal(f.calls.acquire,0);assert.equal(f.calls.publish,0);assert.ok(r.result.card.general.data);assert.equal(r.result.card.financial.data,null);
});
