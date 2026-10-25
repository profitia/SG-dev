import test from 'node:test'
import assert from 'node:assert/strict'
import type {PoolClient} from 'pg'
import {readPilot2PublicCard,PILOT2_PUBLIC_CARD_SQL} from './pilot2-public-catalog'
import {mapMgbiFinancialRecords} from './mgbi-financial'
import {FINANCIAL_MAPPING_VERSION} from './shared-catalog'

const nip='5272443955',krs='0000217580',at='2026-10-25T08:00:00.000Z'
const reference='KRS:'+krs+':'+'a'.repeat(64)
function row(){
 const member={krs,legalName:'Synthetic Company',legalForm:'SA',registeredAt:null,deregisteredAt:null,status:'ACTIVE' as const}
 const history={version:'KRS_CONTINUITY_V1' as const,currentKrs:krs,members:[member],links:[],unlinkedKrs:[]}
 const financial=mapMgbiFinancialRecords([{id:'b'.repeat(24),identifiers:{pl_nip:nip,pl_krs:krs},
  document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31'},
  content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ca_cfy:'300',lae_lapfl_stl_cfy:'200'}}}}],
  {type:'NIP',value:nip},at,1,history).section
 return {general_checked_at:at,financial_checked_at:at,general_json:{status:'SUCCESS',source:{provider:'KRS',model:'OdpisAktualny',recordId:reference},
  retrievedAt:at,effectiveAt:null,warnings:[],data:{nip,krs,legalName:'Synthetic Company',legalForm:'SA',regon:null,
   registeredAddress:null,registeredAt:null,mainPkd:null,registrationStatus:'ACTIVE',
   registrySource:{provider:'KRS',evidenceRef:reference,retrievedAt:at,coverage:'PROGRESSIVE'},
   registryHistory:history}},
  financial_json:{...financial,catalogMappingVersion:FINANCIAL_MAPPING_VERSION}}
}
const client=(value:unknown,onQuery?:(sql:string,args:unknown[])=>void)=>({query:async(sql:string,args:unknown[])=>{
 onQuery?.(sql,args);return {rows:value?[structuredClone(value)]:[]}
}} as unknown as Pick<PoolClient,'query'>)
test('public cache read uses one original catalog read; values, TTL and verified KRS are retained',async()=>{
 const input=row(),before=JSON.stringify(input),queries:string[]=[]
 const value=await readPilot2PublicCard(client(input,(sql,args)=>{queries.push(sql);assert.deepEqual(args,[nip])}),nip,new Date(at))
 assert.equal(queries.length,1);assert.equal(queries[0],PILOT2_PUBLIC_CARD_SQL)
 assert.equal(value?.card.financial.data?.periods.length,1)
 assert.equal(value.card.general.data?.registrySource?.evidenceRef,reference)
 assert.equal(value.card.financial.retrievedAt,at);assert.equal(JSON.stringify(input),before)
 assert.equal(value.card.kys.status,'NOT_REQUESTED');assert.match(value.version,/^[a-f0-9]{64}$/)
})
test('absent, expired, changed mapping and unmatched issuer cannot become a ready cached report',async()=>{
 assert.equal(await readPilot2PublicCard(client(null),nip,new Date(at)),null)
 for(const change of [
  (v:ReturnType<typeof row>)=>{v.financial_checked_at='2026-10-17T00:00:00.000Z'},
  (v:ReturnType<typeof row>)=>{v.general_checked_at='2026-10-17T00:00:00.000Z'},
  (v:ReturnType<typeof row>)=>{v.financial_json.catalogMappingVersion='obsolete'},
  (v:ReturnType<typeof row>)=>{v.financial_json.data!.periods[0].sourceRegistration!.krs='0000000999'},
  (v:ReturnType<typeof row>)=>{v.general_json.data.nip='7820021192'},
 ]){const value=row();change(value);assert.equal(await readPilot2PublicCard(client(value),nip,new Date(at)),null)}
})
test('unchanged provider payload retains its original timestamp after a real successful recheck; cache reads do not renew it',async()=>{
 const old=row(),samePayload=row(),checked='2026-10-25T09:00:00.000Z'
 samePayload.general_checked_at=checked;samePayload.financial_checked_at=checked
 const a=await readPilot2PublicCard(client(old),nip,new Date(checked))
 const b=await readPilot2PublicCard(client(samePayload),nip,new Date(checked))
 assert(a&&b);assert.equal(b.card.financial.retrievedAt,at);assert.equal(b.card.general.retrievedAt,at)
 assert.equal(b.bodyDigest,a.bodyDigest);assert.notEqual(b.version,a.version)
 assert.equal((await readPilot2PublicCard(client(samePayload),nip,new Date(checked)))?.version,b.version)
})
test('unclassified company fields, personal data and forged evidence metadata fail closed',async()=>{
 for(const change of [
  (v:ReturnType<typeof row>)=>{Object.assign(v.general_json.data,{people:[{pesel:'fixture'}]})},
  (v:ReturnType<typeof row>)=>{Object.assign(v.general_json.data.registrySource,{actorId:'fixture'})},
  (v:ReturnType<typeof row>)=>{v.general_json.data.registrySource.retrievedAt='2026-10-24T08:00:00.000Z'},
  (v:ReturnType<typeof row>)=>{v.financial_checked_at='2026-10-25T07:59:59.000Z'},
 ]){const value=row();change(value);await assert.rejects(readPilot2PublicCard(client(value),nip,new Date(at)))}
})
