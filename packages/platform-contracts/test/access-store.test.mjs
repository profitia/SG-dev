import assert from 'node:assert/strict'
import test from 'node:test'
import { ACCESS_STORE_CONTRACT, accessSchemaUrl, accessStoreSourceDigest, createAccessStore } from '../src/access-store.mjs'
import { isOperationDenied } from '../src/operation-context.mjs'

const binding = { applicationId:'sg2-test',environment:'development',projectId:'isolated-project',branchId:'isolated-branch',databaseName:'platform_access_test',role:'platform_access_sg2_test',schemaDigest:'a'.repeat(64) }
const key = { environment:'development',issuer:'https://identity.test',subject:'user-a' }
const descriptor = { ...binding,schemaVersion:'1.0.0',revision:1 }
const row = { database_name:binding.databaseName,role:binding.role,login:binding.role,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolinherit:false,descriptor }
const deny = error => isOperationDenied(error) && error.reasonCode === 'POLICY_UNAVAILABLE'

test('access store publishes an independent schema-bound fingerprint', async () => {
  assert.equal(ACCESS_STORE_CONTRACT.version,'1.2.0')
  assert.equal(Object.isFrozen(ACCESS_STORE_CONTRACT),true)
  assert.match(accessSchemaUrl,/001-internal-access\.sql$/)
  assert.match(await accessStoreSourceDigest(),/^[0-9a-f]{64}$/)
})
for (const [name, change] of Object.entries({missing:{binding:null},environment:{binding:{...binding,environment:'test'}},role:{binding:{...binding,role:'bad;role'}},clock:{binding,now:null}})) {
  test(`access constructor rejects ${name}`,()=>assert.throws(()=>createAccessStore(change),TypeError))
}
for (const [name, change] of Object.entries({database:{database_name:'srm_pmos'},login:{login:'owner'},superuser:{rolsuper:true},bypass:{rolbypassrls:true},createrole:{rolcreaterole:true},createdb:{rolcreatedb:true},inherit:{rolinherit:true},unknownRoleFlag:{rolinherit:null},app:{descriptor:{...descriptor,applicationId:'srm-test'}},environment:{descriptor:{...descriptor,environment:'staging'}},project:{descriptor:{...descriptor,projectId:'foreign'}},branch:{descriptor:{...descriptor,branchId:'foreign'}},schema:{descriptor:{...descriptor,schemaVersion:'0.0.0'}}})) {
  test(`binding read rejects actual ${name} mismatch`,async()=>{
    let calls=0
    const query=async()=>{calls++;return{rows:[{...row,...change}]}}
    await assert.rejects(createAccessStore({binding}).resolveBinding(query,key),deny)
    assert.equal(calls,1)
  })
}
test('binding outage is generic and never exposes a driver diagnostic',async()=>{
  await assert.rejects(createAccessStore({binding}).resolveBinding(async()=>{throw Error('PRIVATE_DRIVER_DIAGNOSTIC')},key),e=>deny(e)&&!e.message.includes('PRIVATE'))
})
test('binding key is captured before the first asynchronous read',async()=>{
  const input={...key};let calls=0
  const query=async(_sql,values)=>{
    if(++calls===1){input.subject='foreign';return{rows:[row]}}
    assert.deepEqual(values,[key.issuer,key.subject]);return{rows:[{binding:null}]}
  }
  assert.equal(await createAccessStore({binding}).resolveBinding(query,input),null)
})
test('audit rejects payload, nested credentials and malformed decisions before SQL',async()=>{
  const store=createAccessStore({binding});let calls=0
  const query=async()=>{calls++;return{rows:[]}}
  const event={applicationId:binding.applicationId,environment:'development',decisionId:'11111111-1111-4111-8111-111111111111',phase:'DECISION',decision:'DENY',reasonCode:'PERMISSION_DENIED'}
  for(const patch of [{payload:{secret:'x'}},{resourceId:{password:'x'}},{resourceId:'Bearer sensitive-fixture'},{productEvidence:[{secret:'x'}]},{applicationId:'foreign'},{reasonCode:'raw driver text'},{phase:'UNKNOWN'}]) await assert.rejects(store.appendAudit(query,{...event,...patch}),deny)
  assert.equal(calls,0)
})
test('unregistered and serialized leases cannot authorize an outcome',async()=>{
  const store=createAccessStore({binding});let calls=0;const query=async()=>{calls++;return{rows:[row]}}
  await assert.rejects(store.verifyScope(query,{expiresAt:new Date(Date.now()+10000).toISOString()}),deny)
  assert.equal(calls,0)
})
test('a valid authority null is a denial, while missing or malformed rows remain technical',async()=>{
  const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',until=new Date(Date.now()+10000).toISOString()
  const actor={kind:'HUMAN',actorId:user,userId:user,environment:'development',audience:binding.applicationId,issuer:key.issuer,expiresAt:until}
  const identityBinding={...key,userId:user,status:'ACTIVE',version:'binding:1:1',sourceRef:'synthetic',expiresAt:until}
  for(const [result,reason]of [[{rows:[{state:null}]},'ACCESS_BASIS_INVALID'],[{rows:[]},'POLICY_UNAVAILABLE'],[{rows:[{}]},'POLICY_UNAVAILABLE'],[{rows:[{state:null},{state:null}]},'POLICY_UNAVAILABLE']]){
    let calls=0;const query=async()=>++calls===1?{rows:[row]}:result
    await assert.rejects(createAccessStore({binding}).lockAccess(query,{actor,identityBinding,organisationId:null}),error=>error.reasonCode===reason)
  }
  await assert.rejects(createAccessStore({binding}).lockAccess(async()=>assert.fail(),{actor,identityBinding:null,organisationId:null}),error=>error.reasonCode==='ACCESS_BASIS_INVALID')
  await assert.rejects(createAccessStore({binding}).lockAccess(async()=>assert.fail(),{actor,identityBinding:undefined,organisationId:null}),deny)
})
test('module audit capability requires its exact independently installed digest',async()=>{
  for(const capability of [null,{version:'0.0.0',schemaDigest:'c'.repeat(64)},{version:'1.0.0',schemaDigest:'d'.repeat(64)}]){
    let calls=0;const query=async()=>({rows:[++calls===1?row:{descriptor:capability}]})
    await assert.rejects(createAccessStore({binding}).verifyModuleAudit(query,'c'.repeat(64)),deny)
  }
  let calls=0;const query=async()=>({rows:[++calls===1?row:{descriptor:{version:'1.0.0',schemaDigest:'c'.repeat(64)}}]})
  await createAccessStore({binding}).verifyModuleAudit(query,'c'.repeat(64))
})
test('only the dedicated SQL expiry state is transported as an access denial by pg and Prisma',async()=>{
  const store=createAccessStore({binding})
  const event={applicationId:binding.applicationId,environment:'development',decisionId:'11111111-1111-4111-8111-111111111111',phase:'DECISION',decision:'DENY',reasonCode:'PERMISSION_DENIED'}
  for(const error of [{code:'PT403'},{code:'P2010',meta:{code:'PT403'}},{code:'42501'},{code:'P2010',meta:{code:'42501'}}]){
    let calls=0;const query=async()=>{if(++calls===1)return{rows:[row]};throw Object.assign(Error('PRIVATE_DRIVER_DIAGNOSTIC'),error)}
    const expected=error.code==='PT403'||error.meta?.code==='PT403'?'ACCESS_BASIS_INVALID':'POLICY_UNAVAILABLE'
    await assert.rejects(store.appendAudit(query,event),e=>e.reasonCode===expected&&!e.message.includes('PRIVATE'))
  }
})
