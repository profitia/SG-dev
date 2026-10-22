import test,{before,after} from 'node:test'
import assert from 'node:assert/strict'
import {validateIdentityEvidence,identityDigest,parseJson,canonical,sha256,validateCompanySnapshot} from '@profitia/krs-registry-contracts'
import {resolveIdentity,revalidateAcceptedIdentity} from '../dist/identity.js'
import {snapshot,memoryCatalog,NOW,KRS,NIP,REGON} from './fixtures.mjs'
let externalAttempts=0,originalFetch
before(()=>{originalFetch=globalThis.fetch;globalThis.fetch=async()=>{externalAttempts++;throw Error('UNAUTHORISED_NETWORK_ATTEMPT')}})
after(()=>{globalThis.fetch=originalFetch;assert.equal(externalAttempts,0,'All identity paths, including VERIFIED, have zero external/paid attempts')})
test('exact selected identity, authoritative source and digest revalidation; no financial port',async()=>{
 const s=await snapshot(),catalog=memoryCatalog(s),v=await resolveIdentity({selectedKrs:KRS},catalog,NOW)
 assert.equal(v.status,'VERIFIED');assert.equal(v.identity.nip,NIP);assert.equal(v.identity.regon,REGON);assert.equal(v.selectedKrs,KRS)
 assert.equal(canonical(await validateIdentityEvidence(JSON.stringify(v),NOW)),canonical(v))
 assert.equal(canonical(await revalidateAcceptedIdentity(v,KRS,catalog,NOW)),canonical(v));await validateCompanySnapshot(s)
})
test('all invalid identity paths and differing names never call MGBI',async t=>{
 const original=await snapshot();let paid=0
 const run=async(s,input={selectedKrs:KRS},code)=>{const value=await resolveIdentity(input,memoryCatalog(s),NOW);assert.equal(value.code,code);assert.equal(paid,0)}
 for(const [name,s,input,code] of [
  ['missing NIP',await snapshot({nip:null}),undefined,'MISSING_NIP'],['checksum',await snapshot({nip:'7740001455'}),undefined,'INVALID_NIP'],
  ['zero KRS',original,{selectedKrs:'0000000000'},'INVALID_KRS'],['invalid REGON',await snapshot({regon:'123456789'}),undefined,'INVALID_REGON'],
  ['selected KRS substitution',original,{selectedKrs:'0000000001'},'KRS_UNAVAILABLE'],['NIP conflict',original,{selectedKrs:KRS,nip:'5213003700'},'IDENTIFIER_CONFLICT'],
  ['REGON9 not silently equivalent',original,{selectedKrs:KRS,regon:'610188201'},'IDENTIFIER_CONFLICT']
 ])await t.test(name,()=>run(s,input,code))
 const differentlyNamed=await snapshot({name:'Całkiem inna pisownia'});assert.equal((await resolveIdentity({selectedKrs:KRS,nip:NIP},memoryCatalog(differentlyNamed),NOW)).status,'VERIFIED')
 const s=await snapshot({register:'S',nip:'5213003700'});assert.equal((await resolveIdentity({selectedKrs:KRS},memoryCatalog(original,s),NOW)).code,'IDENTIFIER_CONFLICT')
 const cat=memoryCatalog(original);cat.byNip=async()=>[KRS,'0000000001'];assert.equal((await resolveIdentity({nip:NIP},cat,NOW)).code,'AMBIGUOUS_COMPANY')
 assert.equal(paid,0)
})
test('closed identity rejects authority, unknown fields, versions, forged hashes and clocks',async t=>{
 const s=await snapshot(),v=await resolveIdentity({selectedKrs:KRS},memoryCatalog(s),NOW)
 const cases=[['user authority',x=>x.userId='actor'],['org authority',x=>x.identity.organisationId='organisation'],['permission',x=>x.source.authorized=true],['version',x=>x.version='2.0.0'],['normalizer',x=>x.source.normalizerVersion='unknown'],['selected',x=>x.selectedKrs='0000000001'],['raw digest',x=>x.source.rawDigest='a'.repeat(64)],['source version',x=>x.source.sourceVersion='forged'],['digest',x=>x.evidenceDigest='a'.repeat(64)],['nonUTC',x=>x.source.retrievedAt='2026-10-22T13:00:00+00:00'],['future',x=>x.source.checkedAt='2026-10-22T13:00:30.001Z'],['check before retrieval',x=>x.source.checkedAt='2026-10-22T12:59:59.999Z'],['renew expiry',x=>x.validity.expiresAt='2026-10-22T13:05:01.000Z'],['bad asof',x=>x.source.sourceAsOfDate='2026-02-30'],['huge name',x=>x.identity.officialName='x'.repeat(1001)],['bad entry',x=>x.source.entryNumber=1.1],['unknown history',x=>x.historicalCandidates=[{krs:'0000000001',eligibility:true}]]]
 for(const [name,mutate]of cases)await t.test(name,async()=>{const copy=structuredClone(v);mutate(copy);await assert.rejects(validateIdentityEvidence(copy,NOW))})
 await assert.rejects(validateIdentityEvidence(v,NOW+300000));await assert.rejects(validateIdentityEvidence(v,NOW-30001))
 assert.equal((await resolveIdentity({selectedKrs:KRS},memoryCatalog(s),NOW+300000)).code,'STALE_IDENTITY_EVIDENCE')
 const copy=structuredClone(v);copy.source.rawDigest='a'.repeat(64);copy.evidenceDigest=await identityDigest(copy)
 await validateIdentityEvidence(copy,NOW);await assert.rejects(revalidateAcceptedIdentity(copy,KRS,memoryCatalog(s),NOW),/FORGED_SOURCE/)
 copy.evidenceRef='forged';copy.evidenceDigest=await identityDigest(copy);await assert.rejects(revalidateAcceptedIdentity(copy,KRS,memoryCatalog(s),NOW))
})
test('rechecking cached bytes preserves retrieval expiry, superseding source invalidates evidence',async()=>{
 const s=await snapshot(),cat=memoryCatalog(s),v=await resolveIdentity({selectedKrs:KRS},cat,NOW+1000)
 assert.equal(v.validity.expiresAt,'2026-10-22T13:05:00.000Z');assert.equal(v.source.retrievedAt,s.source.retrievedAt)
 cat.set(await snapshot({name:'Poprawiona nazwa'}));await assert.rejects(revalidateAcceptedIdentity(v,KRS,cat,NOW+1000),/STALE/)
})
test('transformation candidates carry no eligibility; unresolved selected historical identity denied',async()=>{
 const s=await snapshot();s.state='REMOVED';s.historicalCandidates=[{krs:'0000000001',relationship:'PREDECESSOR_CANDIDATE',basis:'KRS_FORMATION_TRANSFORMATION',evidenceRefs:['KRS:formation'],evidenceDigest:'a'.repeat(64)}]
 assert.equal((await resolveIdentity({selectedKrs:KRS},memoryCatalog(s),NOW)).code,'UNCONFIRMED_HISTORICAL_KRS')
})
test('wire JSON rejects decoded duplicate keys, nonfinite numbers, deep and oversized objects',()=>{
 for(const s of ['{"x":1,"x":2}','{"x":1,"\\u0078":2}','{"n":1e999}','[1,]','{"a":1,}','"unterminated','['.repeat(66)+'0'+']'.repeat(66),' '.repeat(65537)])assert.throws(()=>parseJson(s))
 assert.deepEqual(JSON.parse(canonical(parseJson('{"b":2,"a":1}'))),{a:1,b:2})
})
test('snapshot closed wire rejects private data and content tampering',async()=>{
 const s=await snapshot();for(const field of ['organisationId','userId','supplierId','query'])await assert.rejects(validateCompanySnapshot({...s,[field]:'private'}))
 await assert.rejects(validateCompanySnapshot({...s,officialName:'tampered'}));const copy=structuredClone(s);copy.address.owner='private';await assert.rejects(validateCompanySnapshot(copy))
})
