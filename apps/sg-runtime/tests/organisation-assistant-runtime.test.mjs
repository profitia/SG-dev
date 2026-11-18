import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require=createRequire(import.meta.url),{build}=require('esbuild')
const target=JSON.parse(fs.readFileSync('deployment/assistant-m1-targets.json','utf8'))
const privateTarget=JSON.parse(fs.readFileSync('deployment/private-runtime-targets.json','utf8')).environments.development
test('SaaS assistant keeps the genuine Root profile unbound while sharing only technical resources',async()=>{
 const opened=[],queries=[]
 globalThis.__organisationAssistantPrisma=class{
  constructor(options){opened.push(options)}
  async $queryRawUnsafe(sql){queries.push(sql)
   if(sql.includes('sg2_assistant_history.descriptor()'))return [{binding:{...target.history,applicationId:'spendguru',environment:'development',runtimeRole:target.history.runtimeRole}}]
   if(sql.includes('pg_has_role'))return [{database_name:'neondb',role:target.usage.runtimeRole,login:target.usage.runtimeRole,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolinherit:false,owner_member:false,installed:true,executable:true}]
   return []
  }
  async $executeRawUnsafe(){return 0}
 }
 try{
  const output=await build({entryPoints:[path.resolve('lib/assistant/runtime.ts')],bundle:true,write:false,platform:'node',format:'cjs',alias:{'@':process.cwd()},external:['openai','@profitia/platform-contracts/*'],
   plugins:[{name:'existing-store-driver-fixture',setup(b){b.onResolve({filter:/^@prisma\/client$/},()=>({path:'prisma',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const PrismaClient=globalThis.__organisationAssistantPrisma',loader:'js'}))}}]})
  const module={exports:{}};new Function('require','module','exports',output.outputFiles[0].text)(require,module,module.exports)
  const {createSg2AssistantResources,createSg2AssistantRuntime}=module.exports
  const config={historyUrl:'postgresql://fixture:fixture@localhost/neondb',usageUrl:'postgresql://fixture:fixture@localhost/neondb',historyKey:'a'.repeat(64),usageKey:'b'.repeat(64),openaiKey:'synthetic-no-provider-call',multiSource:false,economicCalendar:false}
  const resources=createSg2AssistantResources(config);assert.equal(opened.length,2);assert.equal(queries.filter(q=>q.includes('prune()')).length,1)
  const common={prisma:{$transaction:async()=>assert.fail('No business SQL in constructor')},auditPrisma:{$queryRawUnsafe:async()=>[], $executeRawUnsafe:async()=>0},
   clerk:{authenticateRequest:async()=>({status:'signed-out'}),sessions:{getSession:async()=>assert.fail()},users:{getUser:async()=>assert.fail()}},
   application:{appId:'spendguru',profileId:'SPENDGURU_SAAS',environment:'development',organisationId:null,deploymentId:'synthetic',configurationVersion:'synthetic',identityIssuer:'https://synthetic.clerk.accounts.dev',features:['benchmark'],operations:['benchmark.selection.read']},
   identity:{appId:'spendguru',environment:'development',issuer:'https://synthetic.clerk.accounts.dev',authorizedParties:['https://sg2.example.test']},
   binding:{applicationId:'spendguru',environment:'development',projectId:privateTarget.projectId,branchId:privateTarget.branchId,databaseName:privateTarget.databaseName,role:privateTarget.runtimeRole,schemaDigest:privateTarget.accessSchemaDigest},resources}
  const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const first=createSg2AssistantRuntime(config,{...common,organisationId:a}),second=createSg2AssistantRuntime(config,{...common,organisationId:b})
  assert.equal(first.organisationId,a);assert.equal(second.organisationId,b)
  assert.equal(first.history,second.history);assert.equal(first.usage,second.usage);assert.equal(first.model,second.model);assert.notEqual(first.gateway,second.gateway)
  await first.ready();await second.ready();assert.equal(opened.length,2);assert.equal(queries.filter(q=>q.includes('prune()')).length,1)
  assert.equal(common.application.organisationId,null)
  for(const patch of [{organisationId:undefined},{organisationId:'invalid'},{application:{...common.application,organisationId:a}},{application:{...common.application,profileId:'PLATFORM_INTERNAL'}},{resources:{...resources}}])
   assert.throws(()=>createSg2AssistantRuntime(config,{...common,organisationId:a,...patch}))
  assert.throws(()=>createSg2AssistantRuntime({...config},{...common,organisationId:a}))
  const fixed=createSg2AssistantRuntime(config,{...common,application:{...common.application,profileId:'PORR_SUITE',organisationId:a}})
  assert.equal(fixed.organisationId,a)
  assert.throws(()=>createSg2AssistantRuntime(config,{...common,organisationId:b,application:{...common.application,profileId:'PORR_SUITE',organisationId:a}}))
  assert.equal(opened.length,2)
 }finally{delete globalThis.__organisationAssistantPrisma}
})
