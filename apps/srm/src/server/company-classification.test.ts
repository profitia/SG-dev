import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyCeidgResult} from './company-classification'
import {fetchCeidgJdg} from './integrations/ceidg'
const nip='8650004194'
const lookup=(response:Response)=>fetchCeidgJdg(nip,{token:'synthetic-classification-only',fetcher:async()=>response})
test('classification returns only the entity decision from a verified matching CEIDG result',async()=>{
 const response=await lookup(Response.json({firma:[{id:'synthetic',nazwa:'PRIVATE BUSINESS NAME',wlasciciel:{nip,imie:'PRIVATE PERSON'}}]}))
 assert.equal(classifyCeidgResult(nip,response),'JDG')
 assert(!JSON.stringify(classifyCeidgResult(nip,response)).includes('PRIVATE'))
})
test('an explicit CEIDG no-data response permits MGBI classification but does not confirm a company',async()=>{
 assert.equal(classifyCeidgResult(nip,await lookup(new Response(null,{status:204}))),'NOT_JDG')
})
for(const [label,response]of [['outage',new Response(null,{status:503})],['mismatch',Response.json({firma:[{id:'synthetic',nazwa:'Other',wlasciciel:{nip:'5272443955'}}]})],['malformed',Response.json({unknown:[]})]] as const)
 test('CEIDG '+label+' stays unavailable and cannot be interpreted as no JDG',async()=>{
  assert.equal(classifyCeidgResult(nip,await lookup(response)),'UNAVAILABLE')
 })
