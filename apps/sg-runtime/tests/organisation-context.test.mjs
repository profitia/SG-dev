import test from 'node:test'
import assert from 'node:assert/strict'
import {bindSg2RequestRuntime,organisationContextConfiguration} from '../lib/platform/organisation-context.ts'
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
test('two concurrent users receive isolated request-local selectors, never a cached default',async()=>{
 const requestA=new Request('https://sg2.example.test/api/current',{headers:{authorization:'Bearer fixture-a'}}),requestB=new Request('https://sg2.example.test/api/current',{headers:{authorization:'Bearer fixture-b'}})
 let calls=0
 const runtime=Object.freeze({provider:'clerk',get defaultOrganisationId(){assert.fail('Unbound SaaS default must not be read')},
  currentOrganisation:async(request)=>{calls++;if(request===requestA)await new Promise(r=>setImmediate(r));return {organisationId:request===requestA?a:b}},
  assistantForOrganisation:async organisationId=>({organisationId}),executor:Object.freeze({canonical:true})})
 const [one,two]=await Promise.all([bindSg2RequestRuntime(runtime,requestA),bindSg2RequestRuntime(runtime,requestB)])
 assert.equal(one.defaultOrganisationId,a);assert.equal(two.defaultOrganisationId,b);assert.notEqual(one,two);assert.equal(one.executor,two.executor)
 assert.equal((await one.assistant()).organisationId,a);assert.equal((await two.assistant()).organisationId,b)
 assert.equal(calls,2);assert.throws(()=>runtime.defaultOrganisationId)
})
test('missing own organisation and failed current reader cannot fall back to a deployment tenant',async()=>{
 for(const currentOrganisation of [async()=>({organisationId:null}),async()=>({organisationId:'invalid'}),async()=>{throw Error('current authority unavailable')}]){
  await assert.rejects(bindSg2RequestRuntime({provider:'clerk',defaultOrganisationId:a,currentOrganisation},new Request('https://sg2.example.test/api/current')))
 }
})
test('unchanged fixed and demo configurations retain their original explicit behavior',async()=>{
 for(const runtime of [{provider:'legacy_demo'},{provider:'clerk',defaultOrganisationId:a}]){
  assert.equal(await bindSg2RequestRuntime(runtime,new Request('https://sg2.example.test/api/current')),runtime)
 }
 assert.equal(organisationContextConfiguration({}),undefined)
 for(const env of [{PROFITIA_ORGANISATION_CONTEXT_ENABLED:'yes'},{PROFITIA_ORGANISATION_CONTEXT_ENABLED:'true',TARGET_ENVIRONMENT:'development',PROFITIA_ORGANISATION_CONTEXT_SCHEMA_DIGEST:'0'.repeat(64)}])assert.throws(()=>organisationContextConfiguration(env))
})
