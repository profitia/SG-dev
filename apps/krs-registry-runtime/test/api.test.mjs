import test from 'node:test'
import assert from 'node:assert/strict'
import {createApi} from '../dist/api.js'
import {RegistryError} from '../dist/errors.js'
const withApi=async(options,fn)=>{const server=createApi(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await fn('http://127.0.0.1:'+server.address().port)}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}}
test('default API health only, no anonymous catalog, no startup acquisition',async()=>{
 let calls=0;await withApi({catalog:{search(){calls++;throw Error()}}},async origin=>{
  assert.deepEqual(await (await fetch(origin+'/health')).json(),{status:'ok'})
  for(const path of ['/v1/companies/search?q=Alfa','/v1/companies/0000028860']){const r=await fetch(origin+path);assert.equal(r.status,503);assert.deepEqual(await r.json(),{code:'E1_REGISTRY_PRODUCER_UNAVAILABLE'})}
  assert.equal((await fetch(origin+'/v1/companies/search?q=Alfa&organisationId=owner')).status,400)
  assert.equal((await fetch(origin+'/v1/companies/search?q=A&q=B')).status,400)
  assert.equal((await fetch(origin+'/v1/companies/search?q=A&limit=500')).status,400)
 });assert.equal(calls,0)
})
test('offline protected adapter simulates two organisations, revocation and audit failure without claiming live E1',async()=>{
 let allowed=true,audit=true,reads=0
 const boundary={async execute(input,read){const token=input.request.headers.authorization;if(!['fixture-org-a','fixture-org-b'].includes(token)||!allowed)throw new RegistryError('AUTHORIZATION_DENIED');const value=await read();if(!audit)throw new RegistryError('AUDIT_UNAVAILABLE');return value}}
 const catalog={async search(){reads++;return {status:'NOT_IN_CATALOG',candidates:[],coverage:{scope:'PROGRESSIVE',totalCompanies:null}}}}
 await withApi({catalog,boundary},async origin=>{
  for(const token of ['fixture-org-a','fixture-org-b']){const r=await fetch(origin+'/v1/companies/search?q=Łódź',{headers:{authorization:token}});assert.equal(r.status,200);assert.equal((await r.json()).coverage.scope,'PROGRESSIVE')}
  allowed=false;assert.equal((await fetch(origin+'/v1/companies/search?q=Alfa',{headers:{authorization:'fixture-org-a'}})).status,403);assert.equal(reads,2)
  allowed=true;audit=false;const denied=await fetch(origin+'/v1/companies/search?q=PRIVATE-INTEREST',{headers:{authorization:'fixture-org-b'}});assert.equal(denied.status,403);assert.equal((await denied.text()).includes('PRIVATE-INTEREST'),false)
  assert.equal((await fetch(origin+'/v1/companies/search?q=Alfa',{headers:{authorization:'unknown'}})).status,403)
 })
})
test('closed bounded resolve body refuses identity overrides and duplicate JSON authority',async()=>{
 await withApi({},async origin=>{
  const post=body=>fetch(origin+'/v1/identity/resolve',{method:'POST',headers:{'content-type':'application/json'},body})
  for(const body of ['{"selectedKrs":"0000028860","nip":null,"regon":null,"organisationId":"owner"}','{"selectedKrs":null,"nip":null,"regon":null,"nip":"7740001454"}','x'.repeat(4097)])assert.equal((await post(body)).status,400)
  assert.equal((await post('{"selectedKrs":"0000028860","nip":null,"regon":null}')).status,503)
 })
})
