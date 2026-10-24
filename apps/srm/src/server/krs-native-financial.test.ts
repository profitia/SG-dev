import test from 'node:test'
import assert from 'node:assert/strict'
import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import {prepareKrsFinancialWork} from './krs-native-financial'
import {mapMgbiFinancialRecords} from './mgbi-financial'
import {readCorporatePacket,CORPORATE_PUBLICATION_VERSION} from './corporate-source-store'
const at='2026-10-22T15:00:00.000Z',now=Date.parse(at),nip='7740001454',krs='0000028860'
async function fixture(foreign=false){
 const {identityDigest}=await import('@profitia/krs-registry-contracts')
 const events:string[]=[],selection={requestId:'11111111-1111-4111-8111-111111111111',organisationId:'22222222-2222-4222-8222-222222222222',command:{kind:'SUPPLIER_REPORT' as const,nip}}
 const identity:VerifiedIdentityV1={contract:'profitia.krs-company-identity',version:'1.0.0',status:'VERIFIED',selectedKrs:krs,identity:{entityKey:'PL:KRS:'+krs,krs,nip,regon:null,officialName:'SYNTHETIC ONLY'},
  source:{provider:'KRS',register:'P',extract:'CURRENT',sourceRecordId:krs,sourceVersion:'fixture',normalizerVersion:'krs-normalizer/1.0.0',rawDigest:'a'.repeat(64),contentDigest:'b'.repeat(64),sourceAsOfDate:null,entryNumber:null,retrievedAt:at,checkedAt:at},
  validity:{policy:'KRS_FINANCIAL_IDENTITY_FRESHNESS_V1',maxAgeSeconds:300,maxClockSkewSeconds:30,expiresAt:new Date(now+300000).toISOString()},evidenceRef:'KRS:'+krs+':'+'a'.repeat(64),evidenceDigest:'0'.repeat(64),historicalCandidates:[]}
 identity.evidenceDigest=await identityDigest(identity)
 const record={id:'b'.repeat(24),identifiers:{pl_nip:nip,pl_krs:foreign?'0000000001':krs},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31'},content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ta_cfy:'1000'}}}}
 const result=mapMgbiFinancialRecords([record],{type:'NIP',value:nip},at);result.rawResponse={pages:[{results:[record]}],recordCount:1}
 let revoked=false
 const check=async()=>{events.push('check');if(revoked)throw Error('REVOKED')}
 const ports={
  createLookup:async()=>{events.push('register');return{requestId:selection.requestId,supplierId:'33333333-3333-4333-8333-333333333333'}},
  fetchMgbiFinancial:async()=>{events.push('financial');return result},
  reprojectFinancialArchive:async()=>null,
  saveMgbiArchive:async()=>{events.push('archive')},saveFinancialDocuments:async()=>{events.push('documents')},
  readFinancialDocuments:async()=>[],enrichMsrFinancial:async(_org:string,_nip:string,base:typeof result,options:{allowedKrs:string[]})=>{assert.deepEqual(options.allowedKrs,[krs]);events.push('msr');return{...base,msrChanged:false}},
  persistSection:async(_org:string,_lookup:unknown,section:string)=>{assert.equal(section,'financial');events.push('persist');return 'snapshot'},
  saveSharedCompany:async(_org:string,_nip:string,value:Parameters<Parameters<typeof prepareKrsFinancialWork>[0]['saveSharedCompany']>[2])=>{assert.equal(value.preserveGeneral,true);assert.equal(value.generalSnapshotId,null);assert.equal(value.general.data,null);readCorporatePacket({version:CORPORATE_PUBLICATION_VERSION,nip,preserveGeneral:value.preserveGeneral,general:value.general,financial:value.financial,facts:value.facts});events.push('public')},
  refreshFinancialIndicators:async()=>[],recordInterest:async()=>{events.push('interest')},
 } as unknown as Parameters<typeof prepareKrsFinancialWork>[0]
 return{events,selection,identity,result,ports,check,revoke:()=>{revoked=true}}
}
test('native Financial composition keeps the original RDF/MSR/archive path and persists only after current reconciliation',async()=>{
 const f=await fixture(),first=await prepareKrsFinancialWork(f.ports,f.selection,f.identity,f.check,()=>now)
 assert.equal(first.pending,true);assert.ok(!f.events.includes('msr'));await assert.rejects(first.publish(first.result))
 f.ports.reprojectFinancialArchive=async()=>f.result
 const work=await prepareKrsFinancialWork(f.ports,f.selection,f.identity,f.check,()=>now)
 assert.equal(work.pending,false)
 assert.equal(f.events.filter(x=>x==='financial').length,1);assert.ok(f.events.includes('archive'));assert.ok(f.events.includes('msr'));assert.ok(!f.events.includes('persist'))
 assert.equal(work.result.section.data?.periods[0].facts[0].amount,'1000')
 await work.publish(work.result);assert.ok(f.events.includes('persist'));assert.ok(f.events.includes('public'))
 await assert.rejects(work.publish(work.result));assert.equal(f.events.filter(x=>x==='persist').length,1)
})
test('invalid or stale identity denies before native registration and paid acquisition',async()=>{
 const f=await fixture();f.identity.identity.nip='7740001455'
 await assert.rejects(prepareKrsFinancialWork(f.ports,f.selection,f.identity,f.check,()=>now));assert.deepEqual(f.events,[])
 const g=await fixture();await assert.rejects(prepareKrsFinancialWork(g.ports,g.selection,g.identity,g.check,()=>now+300001));assert.deepEqual(g.events,[])
})
test('foreign KRS records cannot reach archive, MSR or persistence',async()=>{
 const f=await fixture(true),work=await prepareKrsFinancialWork(f.ports,f.selection,f.identity,f.check,()=>now)
 assert.equal(work.result.section.data,null);assert.ok(!f.events.includes('archive'));assert.ok(!f.events.includes('msr'))
 await assert.rejects(work.publish(work.result));assert.ok(!f.events.includes('persist'))
})
test('revocation after acquisition prevents Financial publication and source projection',async()=>{
 const f=await fixture(),work=await prepareKrsFinancialWork(f.ports,f.selection,f.identity,f.check,()=>now)
 f.revoke();await assert.rejects(work.publish(work.result),/REVOKED/);assert.ok(!f.events.includes('persist'));assert.ok(!f.events.includes('public'))
})

test('native KRS Financial threads the same verified history through acquisition, archive replay, MSR and publication',async()=>{
 const f=await fixture(true),previous='0000000001';
 const history={version:'KRS_CONTINUITY_V1' as const,currentKrs:krs,members:[
  {krs,legalName:'Synthetic current',legalForm:null,status:'ACTIVE' as const,registeredAt:'2026-01-01',deregisteredAt:null},
  {krs:previous,legalName:'Synthetic predecessor',legalForm:null,status:'DEREGISTERED' as const,registeredAt:'2001-01-01',deregisteredAt:'2026-01-02'}],
  links:[{predecessorKrs:previous,successorKrs:krs,basis:'KRS_FORMATION_TRANSFORMATION' as const}],unlinkedKrs:[]};
 const general={status:'SUCCESS' as const,source:{provider:'KRS' as const,model:'OdpisAktualny',recordId:'fixture'},retrievedAt:at,effectiveAt:null,warnings:[],
  data:{legalName:'Synthetic current',legalForm:null,krs,nip,regon:null,registeredAddress:null,registeredAt:null,mainPkd:null,registryHistory:history}};
 f.ports.fetchMgbiFinancial=async(_id,options)=>{assert.equal(options?.companyHistory,history);f.events.push('financial');return f.result};
 f.ports.persistSection=async(_org,_lookup,section)=>{f.events.push('persist-'+section);return 'snapshot'};
 f.ports.reprojectFinancialArchive=async(_org,_nip,actual)=>{assert.equal(actual,history);return null};
 const first=await prepareKrsFinancialWork(f.ports,f.selection,f.identity,f.check,()=>now,general);
 assert.equal(first.pending,true);assert.equal(first.result.section.data?.periods[0].sourceRegistration?.krs,previous);
 f.ports.reprojectFinancialArchive=async(_org,_nip,actual)=>{assert.equal(actual,history);return f.result};
 f.ports.enrichMsrFinancial=async(_org,_nip,base,options)=>{assert.deepEqual(options?.allowedKrs,[krs,previous]);return {...base,msrChanged:false}};
 const work=await prepareKrsFinancialWork(f.ports,f.selection,f.identity,f.check,()=>now,general);
 assert.equal(work.pending,false);assert.equal(work.result.section.data?.periods[0].sourceRegistration?.relationship,'PREDECESSOR');
 await work.publish(work.result);assert.ok(f.events.includes('persist-financial'));assert.equal(f.events.filter(x=>x==='financial').length,1);
});

test('current HUMAN boundaries fence provider results and publication while intermediate checks remain evidence-only',async()=>{
 const f=await fixture(),checkpoints:(string|undefined)[]=[];
 f.ports.reprojectFinancialArchive=async()=>f.result;
 const work=await prepareKrsFinancialWork(f.ports,f.selection,f.identity,async boundary=>{checkpoints.push(boundary);await f.check()},()=>now);
 assert.deepEqual(checkpoints.filter(Boolean),['ACQUISITION']);
 await work.publish(work.result);assert.deepEqual(checkpoints.filter(Boolean),['ACQUISITION','PUBLICATION']);
 assert.ok(checkpoints.filter(v=>v===undefined).length>=5);
});
test('revocation at post-acquisition HUMAN boundary blocks archive; at publication boundary blocks every write',async()=>{
 const f=await fixture();
 await assert.rejects(prepareKrsFinancialWork(f.ports,f.selection,f.identity,async boundary=>{if(boundary==='ACQUISITION')throw Error('SESSION_REVOKED');await f.check()},()=>now),/SESSION_REVOKED/);
 assert.equal(f.events.includes('archive'),false);assert.equal(f.events.includes('persist'),false);
 const g=await fixture();g.ports.reprojectFinancialArchive=async()=>g.result;
 const work=await prepareKrsFinancialWork(g.ports,g.selection,g.identity,async boundary=>{if(boundary==='PUBLICATION')throw Error('SESSION_REVOKED');await g.check()},()=>now);
 await assert.rejects(work.publish(work.result),/SESSION_REVOKED/);assert.equal(g.events.includes('persist'),false);assert.equal(g.events.includes('public'),false);
});
