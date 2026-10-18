import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createExternalCallHost,EXTERNAL_CALL_CONTRACT,ExternalCallUnavailable,externalCallEvidence,externalCallSchemaUrl,externalCallSchemaDigest,externalCallSourceDigest} from '../src/external-call.mjs'
const hash=v=>createHash('sha256').update(v).digest('hex')
const base={sourceId:'source',resourceId:'resource',sourceHost:{ingest:async()=>({value:{status:'COMMITTED'}})},binding:{role:'ordinary_runtime',configurationVersion:'v1',origin:'https://supplier.example',transport:'HTTPS',schemaDigest:'a'.repeat(64),pathRules:[{method:'GET',path:'/api'}]},
 independentQuery:async()=>{throw Error('No query allowed')},query:async()=>{throw Error('No query allowed')},parseCommand:v=>v,buildRequest:()=>({method:'GET',url:'https://supplier.example/api',body:null}),projectResponse:v=>v}
test('external contract explicitly names admitted attempts, not cost, private access or exactly-once delivery',()=>{
 assert.deepEqual(EXTERNAL_CALL_CONTRACT,{id:'profitia.external-call',version:'1.0.0',unit:'UPSTREAM_ATTEMPT_ADMISSION'});assert(Object.isFrozen(EXTERNAL_CALL_CONTRACT))
})
test('unavailability exposes certainty without private diagnostics or safe automatic retry',()=>{
 for(const certainty of ['NOT_SENT','UNVERIFIED','RESULT_NOT_RETAINED','private-secret']){
  const e=new ExternalCallUnavailable(certainty);assert.equal(e.message,'External result unavailable');assert.equal(e.retryAllowed,false)
  assert(['NOT_SENT','UNVERIFIED','RESULT_NOT_RETAINED'].includes(e.certainty));assert(!JSON.stringify(e).includes('private-secret'))
 }
 assert.equal(externalCallEvidence({status:200,body:{}}),null);assert.equal(externalCallEvidence(null),null)
})
test('a fabricated source host or serialized receipt never mints an external port',()=>{
 assert.throws(()=>createExternalCallHost(base),TypeError)
 assert.throws(()=>createExternalCallHost({...base,sourceHost:{contract:{id:'profitia.platform-ingestion',version:'1.0.0'},ingest:base.sourceHost.ingest}}),TypeError)
})
for(const [name,patch]of [
 ['credentials in origin',{origin:'https://user:password@supplier.example'}],['query in origin',{origin:'https://supplier.example?private=x'}],
 ['plain remote HTTP',{origin:'http://supplier.example'}],['file origin',{origin:'file:///tmp/file'}],['wildcard path',{pathRules:[{method:'GET',path:'/*'}]}],
 ['traversal',{pathRules:[{method:'GET',path:'/../api'}]}],['double slash',{pathRules:[{method:'GET',path:'//api'}]}],
 ['encoded path',{pathRules:[{method:'GET',path:'/%61pi'}]}],['unknown method',{pathRules:[{method:'DELETE',path:'/api'}]}],
 ['empty paths',{pathRules:[]}],['extra path selector',{pathRules:[{method:'GET',path:'/api',organisationId:'private'}]}],
 ['owner role token',{role:'runtime;SET ROLE owner'}],['unknown schema',{schemaDigest:'not-an-installed-digest'}],
 ['wildcard configuration',{configurationVersion:'*'}],['untrusted synthetic destination',{transport:'LOCAL_SYNTHETIC_HTTP',origin:'http://supplier.example:1234'}]
])test(name+' is refused before database lookup',()=>assert.throws(()=>createExternalCallHost({...base,binding:{...base.binding,...patch}}),TypeError))
test('extension schema, declarations and source have explicit exact digests',async()=>{
 const sql=fs.readFileSync(new URL(externalCallSchemaUrl));assert.equal(await externalCallSchemaDigest(),hash(sql))
 const expected=createHash('sha256').update(fs.readFileSync(new URL('../src/external-call.mjs',import.meta.url))).update(fs.readFileSync(new URL('../src/external-call.d.mts',import.meta.url))).update(hash(sql)).digest('hex')
 assert.equal(await externalCallSourceDigest(),expected)
})
