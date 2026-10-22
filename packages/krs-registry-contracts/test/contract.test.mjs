import test from 'node:test'
import assert from 'node:assert/strict'
import {krs,nip,regon,calendarDate,instant,canonical,sha256,validateIdentityEvidence} from '../dist/src/index.js'
test('canonical identifiers and checksum policy',()=>{
 assert.ok(krs('0000028860'));assert.ok(nip('7740001454'));assert.ok(regon('610188201'));assert.ok(regon('61018820100003'));assert.equal(regon('61018820100000'),false)
 for(const id of ['0','0000000000','1234567890','7740001455','PL7740001454'])assert.equal(nip(id),false)
 for(const id of ['000000000','00000000000000','123456789','61018820100001'])assert.equal(regon(id),false)
 for(const id of ['1','../1','0000000000'])assert.equal(krs(id),false)
})
test('calendar dates preserve dates; instants are canonical UTC',()=>{
 assert.ok(calendarDate('2024-02-29'));assert.equal(calendarDate('2026-02-29'),false);assert.equal(calendarDate('2026-10-22T00:00:00Z'),false)
 assert.ok(instant('2026-10-22T12:00:00.000Z'));assert.equal(instant('2026-10-22T12:00:00Z'),false)
})
test('canonical JSON and portable SHA256 are deterministic',async()=>{
 assert.equal(canonical({b:null,a:[1,true]}),'{"a":[1,true],"b":null}')
 assert.equal(await sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
 assert.throws(()=>canonical({unknown:undefined}));assert.throws(()=>canonical(Infinity))
})
test('blocked DTO is closed and never echoes invalid selection',async()=>{
 const v={contract:'profitia.krs-company-identity',version:'1.0.0',status:'BLOCKED',selectedKrs:null,identity:null,code:'INVALID_KRS',candidateKrs:[],generalSnapshotRef:null,sourceEvidenceRef:null,retryAfter:null}
 assert.equal(canonical(await validateIdentityEvidence(v,Date.now())),canonical(v))
 for(const copy of [{...v,selectedKrs:'bad'},{...v,eligible:true},{...v,code:'ACCEPTED'},{...v,candidateKrs:['0000028860','0000028860']}])await assert.rejects(validateIdentityEvidence(copy,Date.now()))
})
