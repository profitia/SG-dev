import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server.js'
import { accessSchemaUrl, moduleAuditSchemaUrl } from '@profitia/platform-contracts/access-store'
import { moduleSchemaUrl } from '@profitia/platform-contracts/module-scope'
import { requestReservationSchemaUrl } from '@profitia/platform-contracts/request-ledger'
import { OPERATION_CONTRACT } from '@profitia/platform-contracts/operation-context'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { createSg2PrivateForecastRequestHost } from '../lib/platform/private-host.ts'
import { createOperationForecastRequestHandler, createRuntimeForecastRequestHandler } from '../lib/forecast/request-operation-handlers.ts'
import { forecastRequestResourceId, readForecastRequest } from '../lib/forecast/request-operation.ts'
import { ForecastPreparationCommandSchema } from '../lib/forecast/preparation-queue.ts'
import { POST as deployedPOST } from '../app/api/benchmark/forecast/requests/route.ts'

const pg = createRequire(new URL('../../architecture-lab/package.json', import.meta.url))('pg')
const DATABASE = 'forecast_request_' + randomUUID().replaceAll('-', ''), ROLE = 'sg2_forecast_request_test_runtime'
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ISSUER = 'https://identity.fixture.test', ORIGIN = 'http://localhost:3001'
const sql = [accessSchemaUrl,moduleSchemaUrl,moduleAuditSchemaUrl,requestReservationSchemaUrl].map(path => fs.readFileSync(new URL(path), 'utf8'))
const commandSql = fs.readFileSync(new URL('../prisma/private-store/003-forecast-requests.sql', import.meta.url), 'utf8')
const hash = value => createHash('sha256').update(value).digest('hex'), digests = sql.map(hash), commandDigest = hash(commandSql)
const expiry = () => new Date(Date.now() + 3600000).toISOString()
const command = { kind: 'CURRENT', seriesId: 'synthetic-shared-series', modelId: 'naive', targetSemantics: 'MONTHLY_AVERAGE' }

test('real SG2 request API uses the original command and ordinary private Prisma transaction', async t => {
  const rootUrl = assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner')
  const root = new pg.Client({ connectionString: rootUrl }); await root.connect()
  const url = new URL(rootUrl); url.pathname = '/' + DATABASE
  let owner, prisma, auditPrisma, sdkRevoked = false, externalCalls = 0
  const previousFetch = globalThis.fetch
  try {
    assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount, 0, 'Never adopt an existing database')
    await root.query(`CREATE DATABASE ${DATABASE}`)
    await root.query('BEGIN; SET LOCAL lock_timeout=\'5s\'; SELECT pg_advisory_xact_lock(170001,20261017)')
    try {
      for (const [role,login] of [['profitia_access_owner',false],[ROLE,true]]) {
        if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) await root.query(`CREATE ROLE ${role} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
        assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0], {rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
      }
      await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 4`)
      await root.query('COMMIT')
    } catch(error) { await root.query('ROLLBACK'); throw error }
    owner = new pg.Client({ connectionString: url.toString() }); await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db, DATABASE)
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    const nativeUrl = new URL(url); nativeUrl.username=ROLE; nativeUrl.password='isolated_ci_only'; nativeUrl.search='?connection_limit=3&pool_timeout=3'
    const auditUrl = new URL(nativeUrl); auditUrl.searchParams.set('connection_limit','1')
    prisma = new PrismaClient({ datasources: { db: { url: nativeUrl.toString() } } })
    auditPrisma = new PrismaClient({ datasources: { db: { url: auditUrl.toString() } } })
    globalThis.fetch = async () => { externalCalls++; throw new Error('No provider, network or dispatch permitted') }
    const clerk = {
      async authenticateRequest(request) {
        const user=request.headers.get('authorization')?.replace(/^Bearer external-/,'')
        const ok=[U,V].includes(user), auth={isAuthenticated:true,tokenType:'session_token',userId:'external-'+user,sessionId:'session-'+user,actor:null,
          sessionClaims:{iss:ISSUER,sub:'external-'+user,sid:'session-'+user,azp:ORIGIN,exp:Math.floor(Date.now()/1000)+3600}}
        return {status:ok?'signed-in':'signed-out',isAuthenticated:ok,toAuth:()=>auth}
      },
      sessions:{async getSession(id){return{id,userId:id.replace('session-','external-'),status:sdkRevoked?'revoked':'active',expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000,actor:null}}},
      users:{async getUser(id){return{id,banned:false,locked:false,deprovisioned:false}}},
    }
    const configuration={prisma,auditPrisma,clerk,application:{appId:'spendguru',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'isolated-request',configurationVersion:'1',identityIssuer:ISSUER,organisationId:null,operations:['forecast.request'],features:['forecast']},
      identity:{appId:'spendguru',environment:'development',issuer:ISSUER,authorizedParties:[ORIGIN]},
      binding:{applicationId:'spendguru',environment:'development',projectId:'isolated-request-project',branchId:'isolated-request-branch',databaseName:DATABASE,role:ROLE,schemaDigest:digests[0]},
      module:{id:'benchmark',schemaDigest:digests[1],auditSchemaDigest:digests[2]},requestLedgerDigest:digests[3],commandBoundaryDigest:commandDigest}
    const host=createSg2PrivateForecastRequestHost(configuration), handler=createOperationForecastRequestHandler(host,A)
    const input=({key='request_key_'+randomUUID(),org=A,user=U,body=command,headers={},method='POST'}={})=>new NextRequest(`${ORIGIN}/api/benchmark/forecast/requests?organisationId=${org}`,{
      method,headers:{authorization:`Bearer external-${user}`,'content-type':'application/json','idempotency-key':key,...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})})
    const reset=async({capacity=10,policy=true}={})=>{
      sdkRevoked=false
      assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db,DATABASE)
      await owner.query('DROP SCHEMA IF EXISTS profitia_forecast_requests CASCADE;DROP SCHEMA IF EXISTS profitia_requests CASCADE;DROP SCHEMA IF EXISTS profitia_modules CASCADE;DROP SCHEMA IF EXISTS profitia_access CASCADE')
      await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
      try {
        await owner.query(sql[0]);await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-request-project','isolated-request-branch',$2)",[digests[0],DATABASE])
        await owner.query(sql[1]);await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[digests[1]])
        await owner.query(sql[2]);await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[digests[2]])
        await owner.query(sql[3]);await owner.query("INSERT INTO profitia_requests.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[digests[3]])
        await owner.query(commandSql)
        await owner.query("INSERT INTO profitia_forecast_requests.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[commandDigest])
        await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('spendguru','ACTIVE')")
        await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'spendguru','ACTIVE')",[ROLE])
        for(const user of[U,V]){
          await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user])
          await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),ISSUER,'external-'+user,user,expiry()])
        }
        await owner.query("INSERT INTO profitia_modules.application_bindings(binding_id,application_id,module_id,status,source_ref,expires_at) VALUES($1,'spendguru','benchmark','ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),expiry()])
        for(const org of[A,B]){
          await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
          await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SPENDGURU',ARRAY['forecast','benchmark'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$2)",[org,expiry()])
          for(const user of org===A?[U,V]:[U]){
            await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,user,expiry()])
            await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'ALLOW','forecast.request','forecast')",[randomUUID(),org,user])
          }
          if(policy)await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'spendguru',$2,'forecast.request','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$3,$4)",[randomUUID(),org,expiry(),capacity])
        }
        await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_forecast_requests TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb),profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor(),profitia_requests.runtime_descriptor(),profitia_requests.scope_allows(uuid,uuid,text),profitia_requests.policy(uuid,uuid,text),profitia_requests.reserve(uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.accept(uuid,uuid) TO ${ROLE};GRANT SELECT ON profitia_requests.intents,profitia_forecast_requests.installation,profitia_forecast_requests.commands TO ${ROLE};GRANT INSERT ON profitia_forecast_requests.commands TO ${ROLE}`)
        await owner.query('COMMIT')
      }catch(error){await owner.query('ROLLBACK');throw error}
    }
    const counts=async()=>({commands:Number((await owner.query('SELECT count(*) FROM profitia_forecast_requests.commands')).rows[0].count),intents:Number((await owner.query('SELECT count(*) FROM profitia_requests.intents')).rows[0].count),used:Number((await owner.query('SELECT coalesce(sum(accepted_count),0) AS n FROM profitia_requests.policies')).rows[0].n)})
    const scenario=async(name,fn,options)=>t.test(name,async()=>{await reset(options);await fn()})
    await scenario('original CURRENT and VERIFICATION schemas persist exact private commands without creating compute jobs',async()=>{
      for(const kind of['CURRENT','VERIFICATION']){
        const body={...command,kind};assert.deepEqual(await readForecastRequest(body),ForecastPreparationCommandSchema.parse(body))
        const response=await handler(input({body}));assert.equal(response.status,202);assert.deepEqual(Object.keys(await response.clone().json()).sort(),['requestId','status'])
        assert.equal((await response.json()).status,'ACCEPTED');assert.equal(response.headers.get('cache-control'),'private, no-store')
      }
      const rows=(await owner.query('SELECT command_json,payload_digest,command_text FROM profitia_forecast_requests.commands ORDER BY created_at')).rows
      assert.deepEqual(rows.map(r=>r.command_json.kind),['CURRENT','VERIFICATION']);assert(rows.every(r=>hash(r.command_text)===r.payload_digest))
      assert.equal((await owner.query("SELECT to_regclass('public.\"ForecastPreparationJob\"') AS queue")).rows[0].queue,null)
      assert.equal(externalCalls,0)
    })
    await scenario('concurrent retry has one command, request and unit; accepted reply is projected fresh',async()=>{
      const key='same_key_'+randomUUID(), replies=await Promise.all([handler(input({key})),handler(input({key}))]);assert(replies.every(r=>r.status===202))
      assert.deepEqual(await replies[0].json(),await replies[1].json());assert.deepEqual(await counts(),{commands:1,intents:1,used:1})
    })
    await scenario('current grant revocation refuses an old accepted key',async()=>{
      const key='revocation_'+randomUUID();assert.equal((await handler(input({key}))).status,202)
      await owner.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE organisation_id=$1 AND user_id=$2",[A,U])
      assert.equal((await handler(input({key}))).status,403);assert.deepEqual(await counts(),{commands:1,intents:1,used:1})
    })
    await scenario('scope or command change under a previously accepted actor key conflicts',async()=>{
      const key='scope_key_'+randomUUID();assert.equal((await handler(input({key}))).status,202)
      for(const patch of[{org:B},{body:{...command,kind:'VERIFICATION'}}])assert.equal((await handler(input({key,...patch}))).status,409)
      assert.deepEqual(await counts(),{commands:1,intents:1,used:1})
    })
    await scenario('users and organisations have independent requests; foreign membership fails',async()=>{
      const key='owners_key_'+randomUUID()
      for(const patch of[{},{org:B,key:'other_org_key_'+randomUUID()},{user:V}])assert.equal((await handler(input({key,...patch}))).status,202)
      assert.equal((await handler(input({org:B,user:V}))).status,403);assert.deepEqual(await counts(),{commands:3,intents:3,used:3})
      assert.equal((await prisma.$queryRawUnsafe('SELECT * FROM profitia_forecast_requests.commands')).length,0)
    })
    await scenario('one finite unit permits replay and refuses another new request',async()=>{
      const key='quota_key_'+randomUUID();assert.equal((await handler(input({key}))).status,202);assert.equal((await handler(input({key}))).status,202)
      assert.equal((await handler(input())).status,429);assert.deepEqual(await counts(),{commands:1,intents:1,used:1})
    },{capacity:1})
    await scenario('missing explicit request policy refuses before command persistence',async()=>{
      assert.equal((await handler(input())).status,503);assert.deepEqual(await counts(),{commands:0,intents:0,used:0})
    },{policy:false})
    await scenario('current Clerk revocation refuses without trusting forged identity headers',async()=>{
      sdkRevoked=true;assert.equal((await handler(input({headers:{'x-clerk-user-id':U,'x-clerk-org-role':'owner'}}))).status,401)
      assert.deepEqual(await counts(),{commands:0,intents:0,used:0})
    })
    await scenario('body, header, identity and size validation never admits caller ownership or secrets',async()=>{
      for(const patch of[{body:{...command,organisationId:B}},{body:{...command,userId:V}},{body:{...command,kind:'EXECUTE'}},{body:{...command,seriesId:'*'}},{body:{...command,seriesId:'x'.repeat(17000)}},{headers:{'idempotency-key':'short'}},{headers:{'content-type':'text/plain'}}])assert.equal((await handler(input(patch))).status,400)
      assert.equal((await handler(input({headers:{authorization:'','x-clerk-user-id':U,'x-clerk-org-id':A}}))).status,401)
      assert.deepEqual(await counts(),{commands:0,intents:0,used:0})
    })
    await scenario('OUTCOME failure rolls back domain command, receipt and quota while retaining durable failure',async()=>{
      await owner.query("CREATE FUNCTION profitia_access.reject_outcome_fixture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic outcome outage'; END IF;RETURN NEW;END$$;CREATE TRIGGER reject_outcome_fixture BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_outcome_fixture()")
      assert.equal((await handler(input())).status,503);assert.deepEqual(await counts(),{commands:0,intents:0,used:0})
      assert.deepEqual((await owner.query('SELECT phase FROM profitia_access.security_events ORDER BY event_id')).rows.map(r=>r.phase),['INTENT','FAILURE'])
    })
    await scenario('database independently refuses substituted command owner, environment and payload bytes',async()=>{
      for(const patch of[{user:V},{environment:'staging'},{text:'{}'}]){
        const request=input(), key='sql_fence_'+randomUUID()
        await assert.rejects(host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
          operation:'forecast.request',organisationId:A,resourceId:forecastRequestResourceId(command),payload:command,idempotencyKey:key,request},async(context,tx)=>{
          const text=JSON.stringify(Object.fromEntries(Object.keys(command).sort().map(k=>[k,command[k]])))
          await tx.$executeRawUnsafe('INSERT INTO profitia_forecast_requests.commands(request_id,application_id,environment,organisation_id,user_id,resource_id,payload_digest,decision_id,command_text) VALUES($1::uuid,$2,$3,$4::uuid,$5::uuid,$6,$7,$8::uuid,$9)',
            context.requestReservation.requestId,context.applicationId,patch.environment??context.environment,context.organisationId,patch.user??context.actorId,context.resourceId,context.payloadDigest,context.decisionId,patch.text??text)
          return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}
        }))
      }
      assert.deepEqual(await counts(),{commands:0,intents:0,used:0})
    })
    await scenario('revoked product, membership and module independently refuse current access',async()=>{
      for(const [deny,restore] of[
        ["UPDATE profitia_access.product_grants SET status='REVOKED'","UPDATE profitia_access.product_grants SET status='ACTIVE'"],
        ["UPDATE profitia_access.memberships SET status='SUSPENDED'","UPDATE profitia_access.memberships SET status='ACTIVE'"],
        ["UPDATE profitia_modules.application_bindings SET status='REVOKED'","UPDATE profitia_modules.application_bindings SET status='ACTIVE'"],
      ]){await owner.query(deny);assert.equal((await handler(input())).status,403);await owner.query(restore)}
      assert.deepEqual(await counts(),{commands:0,intents:0,used:0})
    })
    await scenario('wrong domain installation refuses without accepting or consuming',async()=>{
      const wrong=createSg2PrivateForecastRequestHost({...configuration,commandBoundaryDigest:'f'.repeat(64)})
      assert.equal((await createOperationForecastRequestHandler(wrong,A)(input())).status,503);assert.deepEqual(await counts(),{commands:0,intents:0,used:0})
    })
    await scenario('accepted domain commands are immutable even after accidental broad grants',async()=>{
      assert.equal((await handler(input())).status,202)
      await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_forecast_requests TO ${ROLE}`)
      assert.equal(await prisma.$executeRawUnsafe("UPDATE profitia_forecast_requests.commands SET command_text='{}'"),0)
      assert.equal(await prisma.$executeRawUnsafe('DELETE FROM profitia_forecast_requests.commands'),0)
      assert.equal(await prisma.$executeRawUnsafe("UPDATE profitia_forecast_requests.installation SET source_ref='foreign'"),0)
      assert.deepEqual(await counts(),{commands:1,intents:1,used:1})
      const rows=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_forecast_requests' AND c.relkind='r'")).rows
      assert.equal(rows.length,2);assert(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity))
    })
    await scenario('default and disabled entry points cannot fall back to legacy compute or accept a fabricated receipt',async()=>{
      assert.equal((await createRuntimeForecastRequestHandler(()=>({provider:'legacy_demo'}))(input())).status,503)
      assert.equal((await createRuntimeForecastRequestHandler(()=>({provider:'clerk',executor:host,defaultOrganisationId:A}))(input())).status,503)
      assert.equal((await deployedPOST(input())).status,503)
      assert.deepEqual(await counts(),{commands:0,intents:0,used:0})
    })
    assert.equal(externalCalls,0)
  } finally {globalThis.fetch=previousFetch;await prisma?.$disconnect();await auditPrisma?.$disconnect();await owner?.end();await root.end()}
})
