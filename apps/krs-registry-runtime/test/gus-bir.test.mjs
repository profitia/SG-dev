import test from 'node:test'
import assert from 'node:assert/strict'
import {gusRequest,gusResult,gusSearchRecord,gusFullRecord,gusMappingEvidence} from '../dist/gus-bir.js'
const nip='5213415549',regon='140790901',key='a'.repeat(64)
const report=(patch={})=>'<root><dane>'+Object.entries({praw_nip:nip,praw_regon9:regon,praw_rodzajRejestruEwidencji_Symbol:'138',praw_rodzajRejestruEwidencji_Nazwa:'REJESTR PRZEDSIĘBIORCÓW',praw_numerWRejestrzeEwidencji:'271457',...patch}).map(([k,v])=>`<${k}>${v}</${k}>`).join('')+'</dane></root>'
test('GUS mapping preserves exact legal identity and explicitly checks register',()=>{
 assert.deepEqual(gusSearchRecord(`<root><dane><Nip>${nip}</Nip><Regon>${regon}</Regon><Typ>P</Typ></dane></root>`,nip),{regon})
 const m=gusFullRecord(report(),nip,regon,0);assert.equal(m.status,'MATCH');assert.equal(m.krs,'0000271457');assert.equal(gusMappingEvidence(m),null)
 assert.equal(gusFullRecord(report({praw_rodzajRejestruEwidencji_Symbol:'999'}),nip,regon).status,'NOT_KRS')
 assert.equal(gusFullRecord(report({praw_rodzajRejestruEwidencji_Nazwa:'INNY REJESTR'}),nip,regon).status,'NOT_KRS')
 assert.equal(gusFullRecord(report({praw_numerWRejestrzeEwidencji:''}),nip,regon).status,'NO_KRS')
})
test('absent records differ from identity conflicts and ambiguous legal units',()=>{
 assert.equal(gusSearchRecord('',nip).status,'NO_DATA');assert.equal(gusFullRecord('',nip,regon).status,'NO_DATA')
 for(const patch of [{praw_nip:'7740001454'},{praw_regon9:'610188201'},{praw_numerWRejestrzeEwidencji:'0000000000'}])assert.throws(()=>gusFullRecord(report(patch),nip,regon),e=>e.category==='IDENTITY')
 assert.throws(()=>gusSearchRecord(`<root><Nip>${nip}</Nip><Nip>${nip}</Nip></root>`,nip),/GUS_AMBIGUOUS_ENTITY/)
 assert.throws(()=>gusSearchRecord('<root><Nip>7740001454</Nip></root>',nip),/GUS_NIP_MISMATCH/)
})
test('SOAP has closed commands and server credentials only; DTD, faults, invalid XML and missing results refused',()=>{
 const r=gusRequest({action:'DaneSzukajPodmioty',nip,regon:null,requestKey:key},'A'.repeat(20),'B'.repeat(20))
 assert.equal(r.method,'POST');assert(r.body.includes('<d:Nip>'+nip+'</d:Nip>'));assert(!r.body.includes('B'.repeat(20)))
 assert.throws(()=>gusRequest({action:'Zaloguj',nip,regon:null,requestKey:key,url:'https://other.example'},'A'.repeat(20),null))
 const wrap=x=>new TextEncoder().encode('<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>'+x+'</s:Body></s:Envelope>')
 assert.equal(gusResult(wrap('<ZalogujResult>abcdefghijklmnopqrst</ZalogujResult>'),'Zaloguj'),'abcdefghijklmnopqrst')
 assert.throws(()=>gusResult(wrap('<s:Fault/>'),'Zaloguj'),/GUS_SOAP_FAULT/)
 assert.throws(()=>gusResult(wrap('<!DOCTYPE a><ZalogujResult>x</ZalogujResult>'),'Zaloguj'),/GUS_XML_REFUSED/)
 assert.throws(()=>gusResult(wrap('<ZalogujResult>'),'Zaloguj'),/GUS_XML_INVALID/)
 assert.throws(()=>gusResult(wrap(''),'Zaloguj'),/GUS_RESULT_INVALID/)
})
