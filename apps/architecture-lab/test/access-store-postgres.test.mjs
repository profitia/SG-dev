import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import { randomUUID,createHash } from 'node:crypto'
import pg from 'pg'
import { createAccessStore,accessSchemaUrl } from '../../../packages/platform-contracts/src/access-store.mjs'
import { createOperationExecutor,OPERATION_CONTRACT,isOperationDenied } from '../../../packages/platform-contracts/src/operation-context.mjs'
import { createPrivateOperationHost } from '../../../packages/platform-contracts/src/private-operation-host.mjs'
import { assertIsolatedTestConnection } from '../src/operation-postgres-fixture.mjs'

const ORG_A='11111111-1111-4111-8111-111111111111',ORG_B='22222222-2222-4222-8222-222222222222'
const USER_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',USER_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',USER_C='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ISSUER='https://identity.fixture.test',DATABASE='platform_access_test'
const ROLES={sg2:'platform_access_sg2_test',srm:'platform_access_srm_test',unknown:'platform_access_unknown_test'}
const FN=['runtime_descriptor()','identity_binding(text,text)','lock_access(uuid,uuid,text,text,text)','scope_allows(text,uuid,uuid)','append_audit(jsonb)']
const sql=await fs.readFile(new URL(accessSchemaUrl),'utf8')
const schemaDigest=createHash('sha256').update(sql).digest('hex')
const denied=e=>isOperationDenied(e)&&e.reasonCode==='POLICY_UNAVAILABLE'
const expires=()=>new Date(Date.now()+3600000).toISOString()
function binding(app='sg2',overrides={}) { return {applicationId:`${app}-test`,environment:'development',projectId:'isolated-platform-private',branchId:'isolated-development-branch',databaseName:DATABASE,role:ROLES[app],schemaDigest,...overrides} }
function actor(user=USER_A,app='sg2') { return {kind:'HUMAN',actorId:user,userId:user,proofRef:'synthetic-verified-proof',issuer:ISSUER,audience:`${app}-test`,environment:'development',expiresAt:expires()} }

test('access schema and real transaction boundaries with ordinary runtime logins', {skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async t=>{
  // Only this new, explicitly disposable LOOPBACK database may be initialized.
  const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
  const root=new pg.Client({connectionString:rootUrl});await root.connect()
  const dbUrl=new URL(rootUrl);dbUrl.pathname=`/${DATABASE}`
  let owner
  const pools=[]
  try {
    if(!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount) await root.query(`CREATE DATABASE ${DATABASE}`)
    for(const [role,login] of [['profitia_access_owner',false],...Object.values(ROLES).map(r=>[r,true])]) {
      if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) await root.query(`CREATE ROLE ${role} ${login?'LOGIN':'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS${login?" PASSWORD 'isolated_ci_only'":''}`)
      const r=(await root.query('SELECT rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0]
      assert.deepEqual(r,{rolcanlogin:login,rolinherit:false,rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolbypassrls:false})
    }
    await root.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    owner=new pg.Client({connectionString:dbUrl.toString()});await owner.connect()
    await owner.query('SET ROLE profitia_access_owner')
    const poolFor=app=>{
      const u=new URL(dbUrl);u.username=ROLES[app];u.password='isolated_ci_only'
      const pool=new pg.Pool({connectionString:u.toString(),max:2});pools.push(pool);return pool
    }
    const sgPool=poolFor('sg2'),srmPool=poolFor('srm'),unknownPool=poolFor('unknown')
    const reset=async()=>{
      // The source connection and fixed database name above guard these drops.
      await owner.query('DROP SCHEMA IF EXISTS access_product_fixture CASCADE; DROP SCHEMA IF EXISTS profitia_access CASCADE')
      await owner.query('BEGIN')
      try {
        await owner.query(sql)
        await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$2,'development','isolated-platform-private','isolated-development-branch',$1)",[DATABASE,schemaDigest])
        for(const user of [USER_A,USER_B,USER_C]) {
          await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user])
          await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_NOT_CUSTOMER_IDENTITY',$5)",[randomUUID(),ISSUER,`subject-${user}`,user,expires()])
        }
        for(const org of [ORG_A,ORG_B])await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
        for(const app of ['sg2','srm']) {
          await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[`${app}-test`])
          await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')",[ROLES[app],`${app}-test`])
        }
        for(const [org,user] of [[ORG_A,USER_A],[ORG_A,USER_B],[ORG_B,USER_A],[ORG_B,USER_C]]) {
          await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_MEMBERSHIP',$3)",[org,user,expires()])
          for(const app of ['sg2','srm'])for(const operation of ['benchmark.selection.read','benchmark.selection.write','personal.list.read']) {
            await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,'ALLOW',$5,$6)",[randomUUID(),`${app}-test`,org,user,operation,operation.startsWith('personal.')?'personal_workspace':'benchmark'])
          }
        }
        for(const app of ['sg2','srm'])for(const org of [ORG_A,ORG_B])await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,'SPENDGURU',ARRAY['benchmark','personal_workspace'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_NOT_COMMERCIAL_OFFER',$3)",[`${app}-test`,org,expires()])
        await owner.query('CREATE SCHEMA access_product_fixture')
        await owner.query(`CREATE TABLE access_product_fixture.organisation_records(organisation_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),id text NOT NULL,body text,PRIMARY KEY(organisation_id,id));
          CREATE TABLE access_product_fixture.personal_records(organisation_id uuid NOT NULL,user_id uuid NOT NULL,id text NOT NULL,body text,PRIMARY KEY(organisation_id,user_id,id),FOREIGN KEY(organisation_id,user_id) REFERENCES profitia_access.memberships(organisation_id,user_id));
          CREATE TABLE access_product_fixture.account_records(user_id uuid PRIMARY KEY REFERENCES profitia_access.accounts(user_id),body text);
          CREATE TABLE access_product_fixture.child_records(organisation_id uuid NOT NULL,id text NOT NULL,parent_id text NOT NULL,PRIMARY KEY(organisation_id,id),FOREIGN KEY(organisation_id,parent_id) REFERENCES access_product_fixture.organisation_records(organisation_id,id));`)
        for(const table of ['organisation_records','personal_records','account_records','child_records']) {
          await owner.query(`ALTER TABLE access_product_fixture.${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE access_product_fixture.${table} FORCE ROW LEVEL SECURITY;
            CREATE POLICY controlled_owner ON access_product_fixture.${table} TO profitia_access_owner USING(true) WITH CHECK(true);
            CREATE POLICY product_scope ON access_product_fixture.${table} TO ${ROLES.sg2} USING(profitia_access.scope_allows('sg2-test',${table==='account_records'?'NULL':'organisation_id'},${['personal_records','account_records'].includes(table)?'user_id':'NULL'})) WITH CHECK(profitia_access.scope_allows('sg2-test',${table==='account_records'?'NULL':'organisation_id'},${['personal_records','account_records'].includes(table)?'user_id':'NULL'}));`)
        }
        for(const org of [ORG_A,ORG_B]) await owner.query('INSERT INTO access_product_fixture.organisation_records VALUES($1,$2,$3)',[org,`only-${org}`,`body-${org}`])
        for(const [org,user] of [[ORG_A,USER_A],[ORG_A,USER_B],[ORG_B,USER_A],[ORG_B,USER_C]])await owner.query('INSERT INTO access_product_fixture.personal_records VALUES($1,$2,$3,$4)',[org,user,'personal',`body-${org}-${user}`])
        for(const user of [USER_A,USER_B])await owner.query('INSERT INTO access_product_fixture.account_records VALUES($1,$2)',[user,`account-${user}`])
        for(const role of Object.values(ROLES)) {
          await owner.query(`GRANT USAGE ON SCHEMA profitia_access TO ${role}`)
          for(const fn of FN)await owner.query(`GRANT EXECUTE ON FUNCTION profitia_access.${fn} TO ${role}`)
        }
        await owner.query(`GRANT USAGE ON SCHEMA access_product_fixture TO ${ROLES.sg2}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA access_product_fixture TO ${ROLES.sg2}`)
        await owner.query('COMMIT')
      }catch(error){await owner.query('ROLLBACK');throw error}
    }
    const withRuntime=async(fn,{user=USER_A,org=ORG_A,app='sg2',config={}}={})=>{
      const pool=app==='sg2'?sgPool:srmPool;const store=createAccessStore({binding:binding(app,config)})
      const identityBinding=await store.resolveBinding(pool.query.bind(pool),{environment:'development',issuer:ISSUER,subject:`subject-${user}`})
      const client=await pool.connect();await client.query('BEGIN')
      try {const query=client.query.bind(client);const lease=await store.lockAccess(query,{actor:actor(user,app),identityBinding,organisationId:org});return await fn({client,query,lease,store,identityBinding})}
      finally {await client.query('ROLLBACK');client.release()}
    }
    const scenario=async(name,fn)=>t.test(name,async()=>{await reset();await fn()})
    const executorFixture=async()=>{
      const store=createAccessStore({binding:binding()});const identityBinding=await store.resolveBinding(sgPool.query.bind(sgPool),{environment:'development',issuer:ISSUER,subject:`subject-${USER_A}`})
      const application={appId:'sg2-test',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'isolated',configurationVersion:'1',identityIssuer:ISSUER,organisationId:null,features:['benchmark'],operations:['benchmark.selection.write']}
      const executor=createOperationExecutor({application,authenticate:async()=>actor(),recordAudit:e=>store.appendAudit(sgPool.query.bind(sgPool),e),withTransaction:async(_binding,action)=>{
        const c=await sgPool.connect();const query=c.query.bind(c);await query('BEGIN')
        try{const lease=await store.lockAccess(query,{actor:actor(),identityBinding,organisationId:ORG_A});const resource={id:'selection',type:'benchmark_selection',dataClass:'ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:ORG_A,ownerUserId:null,version:'1',projectionVersion:'operation-v1'};const value=await action({state:{...lease.state,resource},transaction:c,transactionalEffects:true,outputBoundaryVersion:'operation-v1',projectOutput:v=>v,recordOutcome:e=>store.appendAudit(query,e,lease)});await store.verifyScope(query,lease);await query('COMMIT');return value}catch(e){await query('ROLLBACK');throw e}finally{c.release()}
      }})
      return {executor,input:{contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'benchmark.selection.write',organisationId:ORG_A,resourceId:'selection',payload:null,request:new Request('https://fixture.test')}}
    }
    const privateHostFixture=(overrides={})=>{
      const application={appId:'sg2-test',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'isolated',configurationVersion:'1',identityIssuer:ISSUER,organisationId:null,features:['benchmark'],operations:['benchmark.selection.read','benchmark.selection.write']}
      const resources=({request,scope})=>({resource:{id:request.resourceId,type:'benchmark_selection',dataClass:'ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:scope.organisationId,ownerUserId:null,version:'1',projectionVersion:'operation-v1'}})
      const transact=async(work,limits)=>{
        const c=await sgPool.connect(),query=c.query.bind(c)
        let expired=false
        const timer=setTimeout(()=>{expired=true;void c.end().catch(()=>{})},limits.timeoutMs)
        await query('BEGIN')
        try{const result=await work({query,transaction:c});await query('COMMIT');return result}
        catch(e){await query('ROLLBACK').catch(()=>{});throw e}
        finally{clearTimeout(timer);c.release(expired)}
      }
      const options={application,binding:binding(),independentQuery:sgPool.query.bind(sgPool),transact,
        // Synthetic backend identity ONLY. Real official SDK/RSA verification is
        // separately covered by clerk-identity.test.mjs; no HTTP header adapter.
        createAuthenticator:({resolveBinding})=>async request=>{
          const user=request.user??USER_A
          const b=await resolveBinding({environment:'development',issuer:ISSUER,subject:`subject-${user}`})
          request.afterResolve?.();if(request.waitFor)await request.waitFor
          return b?actor(user):null
        },
        readResources:async input=>resources(input),projectOutput:value=>value,...overrides}
      return{host:createPrivateOperationHost(options),options,resources,transact,input:{contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'benchmark.selection.write',organisationId:ORG_A,resourceId:'selection',payload:null,request:{}}}
    }
    await scenario('all access tables FORCE RLS and runtime is ordinary, unable to assume owner',async()=>{
      const tables=await owner.query("SELECT c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_access' AND c.relkind='r'")
      assert.equal(tables.rowCount,10);assert.ok(tables.rows.every(x=>x.relrowsecurity&&x.relforcerowsecurity))
      const c=await sgPool.connect();try {assert.equal((await c.query('SELECT current_user AS r')).rows[0].r,ROLES.sg2);await assert.rejects(c.query('SET ROLE profitia_access_owner'),/permission denied/)}finally{c.release()}
    })
    await scenario('no scope returns no organisation, personal or account rows',async()=>{
      for(const table of ['organisation_records','personal_records','account_records'])assert.equal((await sgPool.query(`SELECT * FROM access_product_fixture.${table}`)).rowCount,0)
    })
    await scenario('two members of one organisation see their own personal rows only',async()=>{
      for(const user of [USER_A,USER_B])await withRuntime(async({query,store,lease})=>{
        await store.verifyScope(query,lease)
        assert.deepEqual((await query('SELECT organisation_id,user_id FROM access_product_fixture.personal_records')).rows,[{organisation_id:ORG_A,user_id:user}])
        assert.equal((await query('SELECT * FROM access_product_fixture.organisation_records')).rowCount,1)
      },{user})
    })
    await scenario('one account can select either of its real memberships without leaking the other',async()=>{
      for(const org of [ORG_A,ORG_B])await withRuntime(async({query})=>assert.deepEqual((await query('SELECT organisation_id FROM access_product_fixture.organisation_records')).rows,[{organisation_id:org}]),{org})
    })
    await scenario('nonmember and nonexistent user get the same generic denial',async()=>{
      await assert.rejects(withRuntime(async()=>assert.fail(),{user:USER_B,org:ORG_B}),denied)
      assert.equal(await createAccessStore({binding:binding()}).resolveBinding(sgPool.query.bind(sgPool),{environment:'development',issuer:ISSUER,subject:'unknown'}),null)
    })
    await scenario('account-only context needs no membership and reveals no organisation data',async()=>{
      await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1",[USER_A])
      await withRuntime(async({query,lease})=>{
        assert.equal(lease.state.access.type,'ACCOUNT_SELF')
        assert.equal((await query('SELECT * FROM access_product_fixture.organisation_records')).rowCount,0)
        assert.deepEqual((await query('SELECT user_id FROM access_product_fixture.account_records')).rows,[{user_id:USER_A}])
      },{org:null})
    })
    await scenario('cross organisation writes and foreign parent links fail at the real database',async()=>{
      await withRuntime(async({query})=>{
        await query('SAVEPOINT negative')
        await assert.rejects(query('INSERT INTO access_product_fixture.personal_records VALUES($1,$2,$3,$4)',[ORG_B,USER_A,'bad','body']),/row-level security/)
        await query('ROLLBACK TO SAVEPOINT negative')
        await assert.rejects(query('INSERT INTO access_product_fixture.child_records VALUES($1,$2,$3)',[ORG_A,'bad',`only-${ORG_B}`]),/foreign key/)
        await query('ROLLBACK TO SAVEPOINT negative')
        await assert.rejects(query('INSERT INTO access_product_fixture.personal_records VALUES($1,$2,$3,$4)',[ORG_A,USER_B,'bad','body']),/row-level security/)
      })
    })
    await scenario('runtime cannot read or change authoritative tables or rewrite history',async()=>{
      for(const sql of ["SELECT * FROM profitia_access.accounts","UPDATE profitia_access.memberships SET status='ACTIVE'","INSERT INTO profitia_access.permission_grants DEFAULT VALUES","DELETE FROM profitia_access.security_events","TRUNCATE profitia_access.security_events","SELECT * FROM profitia_access.security_events"]) await assert.rejects(sgPool.query(sql),/permission denied/)
    })
    await scenario('a second application has its own binding and no access to SG2 tables or scope',async()=>{
      await withRuntime(async({query,lease})=>{
        assert.equal(lease.state.applicationId,'srm-test')
        assert.equal((await query('SELECT profitia_access.scope_allows($1,$2,$3) AS allowed',['sg2-test',ORG_A,USER_A])).rows[0].allowed,false)
        await assert.rejects(query('SELECT * FROM access_product_fixture.personal_records'),/permission denied/)
      },{app:'srm'})
    })
    await scenario('wrong environment, project, branch and unmapped login are rejected',async()=>{
      for(const config of [{environment:'staging'},{projectId:'foreign'},{branchId:'foreign'},{applicationId:'srm-test'},{schemaDigest:'0'.repeat(64)}])await assert.rejects(withRuntime(async()=>assert.fail(),{config}),denied)
      await assert.rejects(createAccessStore({binding:binding('unknown')}).resolveBinding(unknownPool.query.bind(unknownPool),{environment:'development',issuer:ISSUER,subject:`subject-${USER_A}`}),denied)
    })
    await scenario('fixed deployment cannot select another otherwise valid membership',async()=>{
      await owner.query("UPDATE profitia_access.applications SET fixed_organisation_id=$1 WHERE application_id='sg2-test'",[ORG_A])
      await assert.rejects(withRuntime(async()=>assert.fail(),{org:ORG_B}),denied)
    })
    for(const [name,sql,values] of [
      ['account disabled',"UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1",[USER_A]],
      ['identity revoked',"UPDATE profitia_access.external_identities SET status='REVOKED' WHERE user_id=$1",[USER_A]],
      ['identity expired',"UPDATE profitia_access.external_identities SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",[USER_A]],
      ['membership suspended',"UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1",[USER_A]],
      ['membership expired',"UPDATE profitia_access.memberships SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",[USER_A]],
      ['organisation suspended',"UPDATE profitia_access.organisations SET status='SUSPENDED' WHERE organisation_id=$1",[ORG_A]],
    ]) await scenario(name,async()=>{await owner.query(sql,values);await assert.rejects(withRuntime(async()=>assert.fail()),denied)})
    await scenario('identity revocation between SDK binding and transaction invalidates the old proof',async()=>{
      const store=createAccessStore({binding:binding()});const identityBinding=await store.resolveBinding(sgPool.query.bind(sgPool),{environment:'development',issuer:ISSUER,subject:`subject-${USER_A}`})
      await owner.query("UPDATE profitia_access.external_identities SET status='REVOKED' WHERE user_id=$1",[USER_A])
      const c=await sgPool.connect();await c.query('BEGIN');try{await assert.rejects(store.lockAccess(c.query.bind(c),{actor:actor(),identityBinding,organisationId:ORG_A}),denied)}finally{await c.query('ROLLBACK');c.release()}
    })
    await scenario('revoking and reactivating an identity does not revive its previous binding version',async()=>{
      const store=createAccessStore({binding:binding()});const key={environment:'development',issuer:ISSUER,subject:`subject-${USER_A}`}
      const oldBinding=await store.resolveBinding(sgPool.query.bind(sgPool),key)
      await owner.query("UPDATE profitia_access.external_identities SET status='REVOKED' WHERE user_id=$1",[USER_A])
      await owner.query("UPDATE profitia_access.external_identities SET status='ACTIVE',version=1 WHERE user_id=$1",[USER_A])
      const newBinding=await store.resolveBinding(sgPool.query.bind(sgPool),key);assert.notEqual(oldBinding.version,newBinding.version)
      const c=await sgPool.connect();await c.query('BEGIN')
      try{await assert.rejects(store.lockAccess(c.query.bind(c),{actor:actor(),identityBinding:oldBinding,organisationId:ORG_A}),denied)}finally{await c.query('ROLLBACK');c.release()}
      await withRuntime(async({store,query,lease})=>store.verifyScope(query,lease))
    })
    await scenario('autocommit query cannot pretend to hold a policy fence',async()=>{
      const store=createAccessStore({binding:binding()});const query=sgPool.query.bind(sgPool);const identityBinding=await store.resolveBinding(query,{environment:'development',issuer:ISSUER,subject:`subject-${USER_A}`})
      await assert.rejects(store.lockAccess(query,{actor:actor(),identityBinding,organisationId:ORG_A}),denied)
    })
    await scenario('early commit and pool reuse cannot keep an old context or lease',async()=>{
      const c=await sgPool.connect();const query=c.query.bind(c);const store=createAccessStore({binding:binding()});const identityBinding=await store.resolveBinding(query,{environment:'development',issuer:ISSUER,subject:`subject-${USER_A}`})
      try{await query('BEGIN');const lease=await store.lockAccess(query,{actor:actor(),identityBinding,organisationId:ORG_A});await query('COMMIT');await assert.rejects(store.verifyScope(query,lease),denied);assert.equal((await query('SELECT * FROM access_product_fixture.personal_records')).rowCount,0)}finally{await query('ROLLBACK');c.release()}
    })
    await scenario('missing, malformed and expired scope deadlines never allow SQL rows',async()=>{
      for(const deadline of ['','not-a-date','2000-01-01T00:00:00Z','infinity','2999-01-01T00:00:00Z'])await withRuntime(async({query})=>{await query("SELECT set_config('profitia.scope_expires_at',$1,true)",[deadline]);assert.equal((await query('SELECT * FROM access_product_fixture.personal_records')).rowCount,0)})
    })
    await scenario('new DENY insertion cannot pass a held operation fence, then takes effect',async()=>{
      await withRuntime(async()=>{
        await owner.query('BEGIN');await owner.query("SET LOCAL lock_timeout='100ms'")
        try{await assert.rejects(owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'sg2-test',$2,$3,'DENY','benchmark.selection.read','benchmark')",[randomUUID(),ORG_A,USER_A]),/lock timeout/)}finally{await owner.query('ROLLBACK')}
      })
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'sg2-test',$2,$3,'DENY','benchmark.selection.read','benchmark')",[randomUUID(),ORG_A,USER_A])
      await withRuntime(async({lease})=>assert.equal(lease.state.access.denies[0].operation,'benchmark.selection.read'))
    })
    await scenario('membership revocation is serialized after an admitted transaction',async()=>{
      await withRuntime(async()=>{
        await owner.query('BEGIN');await owner.query("SET LOCAL lock_timeout='100ms'")
        try{await assert.rejects(owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[ORG_A,USER_A]),/lock timeout/)}finally{await owner.query('ROLLBACK')}
      })
      await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[ORG_A,USER_A])
      await assert.rejects(withRuntime(async()=>assert.fail()),denied)
    })
    await scenario('append-only audit denies another application and secret-bearing envelopes in SQL',async()=>{
      const base={applicationId:'sg2-test',environment:'development',decisionId:randomUUID(),phase:'DECISION',decision:'DENY',reasonCode:'PERMISSION_DENIED'}
      for(const patch of [{applicationId:'srm-test'},{payload:'private'},{resourceId:{secret:'private'}},{productEvidence:[{secret:'private'}]},{resourceId:'Bearer synthetic-sensitive'}])await assert.rejects(sgPool.query('SELECT profitia_access.append_audit($1::jsonb)',[JSON.stringify({...base,...patch})]),/Audit envelope invalid/)
      await sgPool.query('SELECT profitia_access.append_audit($1::jsonb)',[JSON.stringify(base)])
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.security_events')).rows[0].n,1)
    })
    await scenario('actual executor commits product effect with OUTCOME and keeps independent INTENT',async()=>{
      const {executor,input}=await executorFixture()
      await executor.execute(input,async(_context,c)=>{assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE phase='INTENT'")).rows[0].n,1);await c.query('INSERT INTO access_product_fixture.organisation_records VALUES($1,$2,$3)',[ORG_A,'committed','value']);return'ok'})
      assert.equal((await owner.query("SELECT count(*)::int n FROM access_product_fixture.organisation_records WHERE id='committed'")).rows[0].n,1)
      await assert.rejects(executor.execute(input,async(_context,c)=>{await c.query('INSERT INTO access_product_fixture.organisation_records VALUES($1,$2,$3)',[ORG_A,'rolled-back','value']);throw Error('fixture failure')}),denied)
      assert.equal((await owner.query("SELECT count(*)::int n FROM access_product_fixture.organisation_records WHERE id='rolled-back'")).rows[0].n,0)
      assert.deepEqual((await owner.query('SELECT phase FROM profitia_access.security_events ORDER BY event_id')).rows.map(r=>r.phase),['INTENT','OUTCOME','INTENT','FAILURE'])
    })
    for(const [name,change] of [['revoked product',"UPDATE profitia_access.product_grants SET status='REVOKED'"],['expired product',"UPDATE profitia_access.product_grants SET expires_at=clock_timestamp()-interval '1 second'"]])await scenario(name+' denies actual executor before business effects',async()=>{
      await owner.query(change);const {executor,input}=await executorFixture();let called=false
      await assert.rejects(executor.execute(input,async()=>{called=true}),e=>isOperationDenied(e)&&e.reasonCode==='PRODUCT_UNAVAILABLE');assert.equal(called,false)
    })
    await scenario('new explicit DENY overrides a persisted ALLOW in the actual executor',async()=>{
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'sg2-test',$2,$3,'DENY','benchmark.selection.write','benchmark')",[randomUUID(),ORG_A,USER_A])
      const {executor,input}=await executorFixture();let called=false
      await assert.rejects(executor.execute(input,async()=>{called=true}),e=>isOperationDenied(e)&&e.reasonCode==='PERMISSION_DENIED');assert.equal(called,false)
    })
    await scenario('unavailable intent writer prevents any new business effect',async()=>{
      const {executor,input}=await executorFixture();let called=false
      await owner.query(`REVOKE EXECUTE ON FUNCTION profitia_access.append_audit(jsonb) FROM ${ROLES.sg2}`)
      try {await assert.rejects(executor.execute(input,async()=>{called=true}),e=>isOperationDenied(e)&&e.reasonCode==='AUDIT_UNAVAILABLE');assert.equal(called,false)}
      finally{await owner.query(`GRANT EXECUTE ON FUNCTION profitia_access.append_audit(jsonb) TO ${ROLES.sg2}`)}
    })
    await scenario('unavailable OUTCOME rolls back the effect and preserves its durable unresolved INTENT',async()=>{
      const {executor,input}=await executorFixture()
      try {
        await assert.rejects(executor.execute(input,async(_context,c)=>{
          await c.query('INSERT INTO access_product_fixture.organisation_records VALUES($1,$2,$3)',[ORG_A,'audit-rollback','value'])
          await owner.query(`REVOKE EXECUTE ON FUNCTION profitia_access.append_audit(jsonb) FROM ${ROLES.sg2}`)
          return'ok'
        }),e=>isOperationDenied(e)&&e.reasonCode==='AUDIT_UNAVAILABLE')
      }finally{await owner.query(`GRANT EXECUTE ON FUNCTION profitia_access.append_audit(jsonb) TO ${ROLES.sg2}`)}
      assert.equal((await owner.query("SELECT count(*)::int n FROM access_product_fixture.organisation_records WHERE id='audit-rollback'")).rows[0].n,0)
      assert.deepEqual((await owner.query('SELECT phase FROM profitia_access.security_events ORDER BY event_id')).rows.map(r=>r.phase),['INTENT'])
    })
    await scenario('private host composes current identity, RLS, effect and durable atomic audit',async()=>{
      const {host,input}=privateHostFixture()
      const value=await host.execute(input,async(context,c)=>{
        assert.equal(context.actorId,USER_A)
        assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE phase='INTENT'")).rows[0].n,1)
        assert.deepEqual((await c.query('SELECT organisation_id,user_id FROM access_product_fixture.personal_records')).rows,[{organisation_id:ORG_A,user_id:USER_A}])
        await c.query('INSERT INTO access_product_fixture.organisation_records VALUES($1,$2,$3)',[ORG_A,'host-committed','synthetic'])
        return'accepted'
      })
      assert.equal(value.value,'accepted')
      assert.equal((await owner.query("SELECT count(*)::int n FROM access_product_fixture.organisation_records WHERE id='host-committed'")).rows[0].n,1)
      assert.deepEqual((await owner.query('SELECT phase FROM profitia_access.security_events ORDER BY event_id')).rows.map(x=>x.phase),['INTENT','OUTCOME'])
      assert.equal((await sgPool.query('SELECT count(*)::int n FROM access_product_fixture.personal_records')).rows[0].n,0)
    })
    await scenario('one shared private host cannot mix overlapping identity bindings',async()=>{
      let release,ready
      const waitFor=new Promise(resolve=>{release=resolve}),resolved=new Promise(resolve=>{ready=resolve})
      const {host,input}=privateHostFixture()
      const read=async(context,c)=>{
        const rows=(await c.query('SELECT user_id FROM access_product_fixture.personal_records')).rows
        assert.deepEqual(rows,[{user_id:context.actorId}]);return context.actorId
      }
      const a=host.execute({...input,request:{user:USER_A,waitFor,afterResolve:ready}},read)
      await resolved
      try{assert.equal((await host.execute({...input,request:{user:USER_B}},read)).value,USER_B)}finally{release()}
      assert.equal((await a).value,USER_A)
      assert.deepEqual((await owner.query("SELECT DISTINCT event->>'actorId' AS actor FROM profitia_access.security_events WHERE phase='OUTCOME' ORDER BY actor")).rows.map(r=>r.actor),[USER_A,USER_B])
    })
    await scenario('private host rolls back business error and keeps independent failure evidence',async()=>{
      const {host,input}=privateHostFixture()
      await assert.rejects(host.execute(input,async(_context,c)=>{
        await c.query('INSERT INTO access_product_fixture.organisation_records VALUES($1,$2,$3)',[ORG_A,'host-rollback','synthetic']);throw Error('private driver detail')
      }),denied)
      assert.equal((await owner.query("SELECT count(*)::int n FROM access_product_fixture.organisation_records WHERE id='host-rollback'")).rows[0].n,0)
      assert.deepEqual((await owner.query('SELECT phase FROM profitia_access.security_events ORDER BY event_id')).rows.map(x=>x.phase),['INTENT','FAILURE'])
    })
    await scenario('private host rejects an actor without its request-owned binding',async()=>{
      const {host,input}=privateHostFixture({createAuthenticator:()=>async()=>actor()})
      await assert.rejects(host.execute(input,()=>assert.fail()),denied)
    })
    await scenario('private host rejects replacing the current binding with another user',async()=>{
      const {host,input}=privateHostFixture({createAuthenticator:({resolveBinding})=>async()=>{
        await resolveBinding({environment:'development',issuer:ISSUER,subject:`subject-${USER_B}`});return actor()
      }})
      await assert.rejects(host.execute(input,()=>assert.fail()),denied)
    })
    await scenario('private host denies a nonmember and never invokes business code',async()=>{
      const {host,input}=privateHostFixture()
      await assert.rejects(host.execute({...input,organisationId:ORG_B,request:{user:USER_B}},()=>assert.fail()),denied)
    })
    await scenario('resource reader cannot override authoritative rights or products',async()=>{
      const {host,input}=privateHostFixture({readResources:async()=>({resource:{},products:[]})})
      await assert.rejects(host.execute(input,()=>assert.fail()),denied)
    })
    await scenario('private host rejects a skipped transaction callback or a pool-level query',async()=>{
      const f=privateHostFixture({transact:async()=>({decision:'ALLOW'})})
      await assert.rejects(f.host.execute(f.input,()=>assert.fail()),denied)
      const o=f.options
      const host=createPrivateOperationHost({...o,transact:async work=>work({query:o.independentQuery,transaction:{}})})
      await assert.rejects(host.execute(f.input,()=>assert.fail()),denied)
    })
    await scenario('replaying a transaction callback rolls back its first execution',async()=>{
      const f=privateHostFixture()
      const host=createPrivateOperationHost({...f.options,transact:async(work,limits)=>f.transact(async session=>{await work(session);return work(session)},limits)})
      await assert.rejects(host.execute(f.input,async(_context,c)=>{
        await c.query('INSERT INTO access_product_fixture.organisation_records VALUES($1,$2,$3)',[ORG_A,'host-replayed','synthetic']);return'no'
      }),denied)
      assert.equal((await owner.query("SELECT count(*)::int n FROM access_product_fixture.organisation_records WHERE id='host-replayed'")).rows[0].n,0)
      assert.deepEqual((await owner.query('SELECT phase FROM profitia_access.security_events ORDER BY event_id')).rows.map(x=>x.phase),['INTENT','FAILURE'])
    })
    await scenario('early commit in a resource loader is rejected before any business effect',async()=>{
      const f=privateHostFixture()
      const host=createPrivateOperationHost({...f.options,readResources:async args=>{await args.query('COMMIT');return f.resources(args)}})
      await assert.rejects(host.execute(f.input,()=>assert.fail()),denied)
    })
    await scenario('driver total timeout bounds multiple individually short statements',async()=>{
      const {host,input}=privateHostFixture({transactionTimeoutMs:100})
      await assert.rejects(host.execute(input,async(_context,c)=>{
        await c.query('INSERT INTO access_product_fixture.organisation_records VALUES($1,$2,$3)',[ORG_A,'host-timeout','synthetic'])
        await c.query('SELECT pg_sleep(0.08)');await c.query('SELECT pg_sleep(0.08)');return'no'
      }),denied)
      assert.equal((await owner.query("SELECT count(*)::int n FROM access_product_fixture.organisation_records WHERE id='host-timeout'")).rows[0].n,0)
    })
  } finally {for(const pool of pools)await pool.end();if(owner)await owner.end();await root.end()}
})
