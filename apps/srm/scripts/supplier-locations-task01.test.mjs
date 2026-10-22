import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {fileURLToPath} from 'node:url'
import {mapMgbiGeneralRecord, fetchMgbiGeneral} from '../src/server/mgbi-general.ts'
import {fetchVerclyKys} from '../src/server/vercly-kys.ts'
import {parseLocations} from '../../../packages/maps-contracts/index.mjs'
import {IMPLEMENTED_OPERATIONS} from '../../../packages/platform-contracts/src/operation-context.mjs'
import {resolveProjectProfile} from '../../../scripts/governance/project-profile.mjs'
import {resolveProjectRouting} from '../../../scripts/governance/routing-engine.mjs'

// TASK 01 design/source evidence only. No new location writer or authorizer is implemented.
const root = fileURLToPath(new URL('../../../', import.meta.url))
const contract = JSON.parse(fs.readFileSync(new URL('../../../Canon/evidence/2026-10-21-srm-supplier-locations-task01-contract.json', import.meta.url), 'utf8'))
const at = '2026-10-21T12:00:00.000Z'
const fixture = () => ({id:'SYNTHETIC_MGBI',identifiers:{pl_nip:'1234567890',pl_krs:'0000000001'},content:{current_excerpt:{naglowekA:{stanZDnia:'21.10.2026'},dane:{dzial1:{danePodmiotu:{nazwa:'SYNTHETIC COMPANY'},siedzibaIAdres:{adres:{ulica:'SYNTHETIC STREET',nrDomu:'1',kodPocztowy:'00-001',miejscowosc:'SYNTHETIC CITY',kraj:'POLSKA'}}}}}}})

test('design distinguishes all three groups and remains explicitly unadopted',()=>{
  assert.equal(contract.status,'DESIGN_NOT_ADOPTED')
  assert.deepEqual(Object.keys(contract.groups),['SUPPLIER_LOCATIONS','RELATED_ENTITIES','USER_LOCATIONS'])
  assert.equal(contract.verdicts.E1_PRODUCER_PUBLICATION,'PENDING')
  assert.equal(contract.verdicts.SRM_CONSUMER_ADOPTION_READY,'NO')
  assert.ok(contract.consumerAcceptance.length >= 10)
})

test('SYNTHETIC MGBI fixture exercises the actual headquarters mapper and source date',()=>{
  const input=fixture(),result=mapMgbiGeneralRecord(input,at)
  assert.equal(result.section.data.registeredAddress,'SYNTHETIC STREET, 1, 00-001, SYNTHETIC CITY, POLSKA')
  assert.equal(result.section.effectiveAt,'2026-10-21')
  assert.equal(result.section.source.recordId,'SYNTHETIC_MGBI')
  delete input.content.current_excerpt.dane.dzial1.siedzibaIAdres.adres
  assert.equal(mapMgbiGeneralRecord(input,at).section.data.registeredAddress,null)
})

test('SYNTHETIC unknown provider address stays archived and does not invent a branch',async()=>{
  const input=fixture(); input.unverifiedExtraAddress={text:'SYNTHETIC PRIVATE SOURCE'}
  let calls=0
  const result=await fetchMgbiGeneral({type:'NIP',value:'1234567890'},{apiKey:'synthetic-only',now:()=>new Date(at),fetcher:async()=>{calls++;return Response.json({count:1,results:[input]})}})
  assert.equal(calls,1)
  assert.equal(JSON.stringify(result.section.data).includes('SYNTHETIC PRIVATE SOURCE'),false)
  assert.deepEqual(result.rawResponse.pages[0].results[0].unverifiedExtraAddress,input.unverifiedExtraAddress)
  assert.equal(contract.providerVerdicts.BRANCHES,'NOT_CONFIRMED')
  assert.equal(contract.providerFields.find(x=>x.id==='MGBI_BRANCH').path,null)
  assert.match(contract.enabledPopulation.BRANCH,/DISABLED/)
})

test('SYNTHETIC existing KYS mapper separates related companies and does not expose their raw addresses',async()=>{
  let calls=0
  const result=await fetchVerclyKys({identifier:{type:'NIP',value:'5272443955'}},{apiKey:'synthetic-only',baseUrl:'https://synthetic.invalid',sleep:async()=>{},now:()=>new Date(at),fetcher:async()=>{
    if(++calls===1)return Response.json(['syntheticCorrelation'])
    return Response.json([{Header:{CorrelationId:'syntheticCorrelation',Id:'SYNTHETIC_REPORT'},Body:{IsComplete:true,Entity:{Name:'SYNTHETIC SUPPLIER',Ids:[{Type:'VatID',Value:'5272443955'}],DepPersons:{Values:[{FullName:'SYNTHETIC_PERSON'}]}},DepEntities:[{Name:'SYNTHETIC RELATED LEGAL CANDIDATE',Role:'SYNTHETIC ROLE',Ids:[{Type:'Krs',Value:'0000000002'},{Type:'Nip',Value:'5272443955'}],Attributes:[{Name:'Start',Value:'2026-01-01'},{Name:'Koniec',Value:'2026-12-31'},{Name:'Street',Value:'SYNTHETIC PRIVATE RESIDENCE'}],Mandates:[{Description:'SYNTHETIC STAKE'}]}]}}])
  }})
  assert.equal(calls,2)
  assert.equal(result.section.data.relatedEntities.length,1)
  const related=result.section.data.relatedEntities[0]
  assert.equal(related.krs,'0000000002')
  assert.equal(related.relationshipEnd,'2026-12-31')
  assert.equal('address' in related,false)
  assert.equal(JSON.stringify(related).includes('SYNTHETIC PRIVATE RESIDENCE'),false)
  assert.equal(JSON.stringify(related).includes('SYNTHETIC_PERSON'),false)
})

test('existing Maps projection preserves co-located business identities and an unlocated legal entity',()=>{
  const points=parseLocations(contract.samples)
  assert.equal(points.length,3)
  assert.notEqual(points[0].id,points[2].id)
  assert.deepEqual(points[0].position,points[2].position)
  assert.equal(points[1].status,'unresolved')
  assert.equal(contract.identity.deduplicateByCoordinates,false)
  assert.equal(contract.identity.deduplicateByAddressAlone,false)
})

test('generic Maps projection strips tenant/actor IDs, KYS provenance and raw payloads',()=>{
  const value=parseLocations([{...contract.samples[0],organisationId:'org-a',userId:'user-a',relationship:{private:true},token:'SYNTHETIC_TOKEN',rawReport:{private:true}}])[0]
  for(const key of ['organisationId','userId','relationship','token','rawReport'])assert.equal(key in value,false)
})

test('organisation ownership and creation authorship are separate design requirements',()=>{
  assert.equal(contract.resource.dataClass,'ORGANISATION_PRIVATE')
  assert.deepEqual(contract.resource.ownerKeys,['organisationId'])
  assert.equal(contract.resource.securityOwnerUserId,null)
  assert.deepEqual(contract.resource.authorFields,['createdByUserId','updatedByUserId'])
  assert.equal(contract.access.revokedMembership,'DENY_AND_INVALIDATE_HOST_PROJECTION')
  assert.equal(contract.access.crossOrganisation,'DENY')
})

test('KYS-derived relation/address expires with the private source and excludes persons',()=>{
  assert.equal(contract.provenancePolicy.naturalPersonsAllowed,false)
  assert.equal(contract.provenancePolicy.rawKysAllowedInMap,false)
  assert.equal(contract.provenancePolicy.classificationDoesNotBecomeSharedByEnrichment,true)
  assert.equal(contract.provenancePolicy.maxKysHours,168)
  assert.equal(contract.geocodingPolicy.relatedExpiryBoundedByKys,true)
})

test('proposed E1 operations are complete proposals and are not claimed as existing permissions',()=>{
  assert.equal(contract.operations.length,4)
  for(const op of contract.operations){
    assert.equal(IMPLEMENTED_OPERATIONS.includes(op.operation),false)
    for(const key of ['feature','resourceType','dataClass','effect','product','actor','permission','usage','idempotency','audit'])assert.ok(op[key],key)
  }
  assert.equal(contract.access.missingAudit,'DENY')
  assert.equal(contract.access.missingBudget,'DENY_NEW_EXTERNAL_EFFECT')
})

test('all proposed paths resolve under their intended owner and SRM cannot mutate E1 producer source',()=>{
  for(const [project,paths]of Object.entries(contract.routing)){
    const result=resolveProjectRouting({profile:resolveProjectProfile(project,root),targets:paths.map(x=>x.path),repositoryRoot:root})
    assert.equal(result.ok,true,result.error)
    for(const item of result.results)assert.equal(item.resolutionStatus,'RESOLVED')
  }
  assert.equal(resolveProjectRouting({profile:resolveProjectProfile('SRM',root),targets:['packages/platform-contracts/src/operation-context.mjs'],repositoryRoot:root}).ok,false)
})

test('Google cache and provider cost gates do not turn organisation ownership into permanent shared coordinates',()=>{
  assert.equal(contract.geocodingPolicy.coordinateCacheMaxDays,30)
  assert.equal(contract.geocodingPolicy.indefiniteEndUserCacheSharedAcrossUsers,false)
  assert.equal(contract.geocodingPolicy.defaultProviderCalls,0)
  assert.equal(contract.geocodingPolicy.automaticPaidRetry,false)
  assert.equal(contract.geocodingPolicy.failedOrAmbiguousMarker,false)
  assert.deepEqual(contract.geocodingPolicy.acceptedAutomaticLocationTypes,['ROOFTOP'])
})

test('geocoding stays in the existing runtime behind a separately adopted server command',()=>{
  const transport=contract.geocodingTransport
  assert.match(transport.status,/REQUIRES_E1_PRODUCER/)
  assert.equal(transport.endpoint,'POST /api/internal/geocode')
  assert.deepEqual(transport.requestFields,['commandId','jobRef','addressVersion','address'])
  assert.deepEqual(transport.authorityFieldsInRequestBody,[])
  assert.equal(transport.maxAddressChars,512)
  assert.equal(transport.providerDeadlineMs,7000)
  assert.match(transport.persistence,/never connects to the SRM business schema/)
})

test('lifecycle covers reopening, source uncertainty, private expiry and manual preservation obligations',()=>{
  const events=new Set(contract.lifecycle.map(x=>x.event))
  for(const event of ['REOPEN_REPORT','NEW_ACCEPTED_REPORT','PARTIAL_OR_FAILED_SOURCE','MANUAL_CHANGE','PRIVATE_SOURCE_EXPIRY','GOOGLE_COORDINATE_EXPIRY'])assert.ok(events.has(event))
  assert.match(contract.lifecycle.find(x=>x.event==='REOPEN_REPORT').action,/no source acquisition/)
  assert.match(contract.lifecycle.find(x=>x.event==='NEW_ACCEPTED_REPORT').action,/preserve manual/)
})
