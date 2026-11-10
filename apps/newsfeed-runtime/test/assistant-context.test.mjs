import test from 'node:test'
import assert from 'node:assert/strict'
import {createApplication} from '../src/server.mjs'
import {createRepository} from '../src/repository.mjs'

test('SYNTHETIC_ONLY: native E1 and ordinary PostgreSQL isolate the new stored assistant read and deny revocation',async t=>{
 const {fixture,observation:seed,U,A,B}=await import('./fixtures.mjs')
 const f=await fixture();t.after(()=>f.close())
 const app=createApplication({authorizer:{...f.newsfeedAuthorizer,assistantReadEnabled:true},repository:f.newsfeedRepository,
  sourceHub:{acquire(){assert.fail('Stored read must not acquire')}},log:()=>{}})
 const req=(user='A',organisationId=A,selection='')=>new Request(f.newsfeed.publicOrigin+'/v1/assistant-context'+selection,
  {headers:{authorization:'Bearer SYNTHETIC_'+user,'x-profitia-organisation-id':organisationId}})
 const created=await f.newsfeedAuthorizer.execute({request:req(),organisationId:A,resourceId:'newsfeed-observations',write:true},
  (c,tx)=>f.newsfeedRepository.create(tx,c,seed))
 const path='?observationId='+created.id
 const own=await app.handle(req('A',A,path)),body=await own.json()
 assert.equal(own.status,200);assert.equal(body.observations[0].id,created.id);assert.equal(body.observations[0].name,seed.name)
 for(const [user,organisationId] of [['B',A],['A',B]]){
  const r=await app.handle(req(user,organisationId,path));assert.equal(r.status,404)
  assert(!JSON.stringify(await r.json()).includes(seed.name))
 }
 await f.admin(1,'profitia_access_owner',q=>q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1 AND organisation_id=$2",[U,A]))
 const revoked=await app.handle(req('A',A,path));assert.equal(revoked.status,403)
 assert(!JSON.stringify(await revoked.json()).includes(seed.name));assert.equal(f.state.providerCalls.length,0)
})

const org='225e465b-8b89-467d-92d1-7fef61b555fe',owner='092c2d9f-a84b-4c18-b3d6-e172a61399b8',id='0d8e3730-11ad-4378-8d60-20f660d96858'

test('M2 build contract pins only its owned source projection and leaves existing SDK acceptance byte-for-byte intact',async()=>{
 const {readFileSync}=await import('node:fs'),{createHash}=await import('node:crypto'),{execFileSync}=await import('node:child_process')
 const root=new URL('../../../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('../assistant-context-integration.json',import.meta.url),'utf8'))
 assert.equal(manifest.contract.id,'newsfeed-assistant-stored-read');assert.equal(manifest.contract.version,'1.0.0')
 assert.equal(manifest.configuration.version,'newsfeed-assistant-read-v1');assert.equal(manifest.configuration.enabledByDefault,false)
 assert.deepEqual(manifest.operations,['personal.list.read']);assert.equal(manifest.grantsAccess,false)
 assert.equal(manifest.previousSourceSha,'57b85043b0781faf9bebb0dee793c7003cf6bf09')
 for(const [p,h]of Object.entries(manifest.sourceDigests)){
  assert(p.startsWith('apps/newsfeed-runtime/src/')||p==='apps/newsfeed-runtime/test/assistant-context.test.mjs')
  assert.equal(createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex'),h,p)
 }
 assert.deepEqual(Object.keys(manifest.sourceDigests).sort(),['apps/newsfeed-runtime/src/auth.mjs','apps/newsfeed-runtime/src/config.mjs',
  'apps/newsfeed-runtime/src/repository.mjs','apps/newsfeed-runtime/src/server.mjs','apps/newsfeed-runtime/test/assistant-context.test.mjs'].sort())
 assert.deepEqual(readFileSync(new URL('apps/newsfeed-runtime/operation-integration.json',root)),
  execFileSync('git',['show',manifest.previousSourceSha+':apps/newsfeed-runtime/operation-integration.json'],{cwd:root}))
})

const request=(path='/v1/assistant-context',headers={})=>new Request('https://newsfeed-api-development.onrender.com'+path,{headers:{authorization:'Bearer unit-test-session','x-profitia-organisation-id':org,...headers}})
test('assistant projection is default disabled and allows only bounded read selections',async()=>{
 let reads=0
 const repository={assistantContext:async()=>{reads++;return {version:'newsfeed-assistant-read-v1',status:'EMPTY',observations:[],truncated:false}}}
 const authorizer={assistantReadEnabled:false,async execute(input,action){assert.equal(input.write,false);assert.equal(input.organisationId,org);return action({subjectUserId:owner},{query(){assert.fail('Unexpected writer')}})}}
 let app=createApplication({repository,authorizer,sourceHub:{acquire(){assert.fail('Acquisition is excluded')}},log:()=>{}})
 assert.equal((await app.handle(request())).status,404);assert.equal(reads,0)
 authorizer.assistantReadEnabled=true
 app=createApplication({repository,authorizer,sourceHub:{acquire(){assert.fail('Acquisition is excluded')}},log:()=>{}})
 const response=await app.handle(request())
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie, Authorization');assert.equal(reads,1)
 assert.equal((await app.handle(request('/v1/assistant-context?actorId=foreign'))).status,400)
 assert.equal((await app.handle(request('/v1/assistant-context?observationId=invalid'))).status,400)
 assert.equal((await app.handle(request('/v1/assistant-context?supplierNip=5250001009&supplierNip=5250001009'))).status,400)
 assert.equal((await app.handle(request('/v1/assistant-context',{cookie:'private-session'}))).status,401)
 assert.equal(reads,1)
})
test('current authorizer denial publishes no private repository data or exception text',async()=>{
 const app=createApplication({repository:{assistantContext(){assert.fail('Denied source read')}},authorizer:{assistantReadEnabled:true,execute(){throw Object.assign(Error('private headline'),{name:'OperationDenied'})}},sourceHub:{},log:()=>{}})
 const r=await app.handle(request());assert.equal(r.status,403);assert(!JSON.stringify(await r.json()).includes('headline'))
})
test('repository reuses exact scope predicates, publishes distinct dates and never invokes writes',async()=>{
 const scope={environment:'development',applicationId:'newsfeed-app',organisationId:org,subjectUserId:owner}
 const observation={id,environment:'development',application_id:'newsfeed-app',organisation_id:org,owner_user_id:owner,created_by_actor_id:owner,updated_by_actor_id:owner,name:'Saved topic',
  subject_kind:'topic',subject:'Stored topic',filters:{},status:'ACTIVE',version:1,created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-02T00:00:00Z'}
 const publication='6aa20bcf-2ca9-4434-9d9f-d7ab8caa2926'
 const transaction={async query(sql,values){
  assert.match(sql,/^SELECT /);assert.deepEqual(values.slice(0,4),['development','newsfeed-app',org,owner])
  assert.match(sql,/organisation_id=\$3::uuid/);assert.match(sql,/owner_user_id=\$4::uuid/)
  if(sql.includes('FROM newsfeed.observations'))return {rows:[observation]}
  if(sql.includes('FROM newsfeed.monitor_runs'))return {rows:[]}
  if(sql.includes('FROM newsfeed.publications p'))return {rows:[{id:publication,provider_id:'stored',url:'https://example.com/article',headline:'Stored publication',
   published_at:'2026-10-31T00:00:00Z',discovered_at:'2026-11-01T00:00:00Z',publication_status:'SEEN'}]}
  if(sql.includes('SELECT publication_id,detected_at'))return {rows:[{publication_id:publication,detected_at:'2026-11-02T00:00:00Z'}]}
  assert.fail('Unreviewed source statement')
 }}
 const repo=createRepository({},{}),r=await repo.assistantContext(transaction,scope,{observationId:id})
 assert.equal(r.observations[0].publications[0].publishedAt,'2026-10-31T00:00:00.000Z')
 assert.equal(r.observations[0].publications[0].discoveredAt,'2026-11-01T00:00:00.000Z')
 assert.equal(r.observations[0].publications[0].detectedAt,'2026-11-02T00:00:00.000Z')
 assert(!JSON.stringify(r).includes(owner));assert(!JSON.stringify(r).includes(org))
 assert.deepEqual((await repo.assistantContext(transaction,scope,{observationId:id,supplierNip:'5250001009'})).observations,[])
})

