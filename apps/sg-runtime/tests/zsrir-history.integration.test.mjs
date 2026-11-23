import assert from 'node:assert/strict'
import {createHash, randomBytes, randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import test from 'node:test'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'

const {Client} = createRequire(new URL('../../architecture-lab/package.json', import.meta.url))('pg')
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const hash = value => createHash('sha256').update(value).digest('hex')
const migration = name => read('../../../packages/platform-contracts/migrations/access/' + name)
const sourceSql = migration('008-platform-ingestion.sql')
const externalSql = migration('009-external-call-admission.sql')
const nativeSql = migration('012-native-external-transport.sql')
const unmeteredSql = migration('024-unmetered-public-sources.sql')
const boundary = read('../prisma-market-data/private-write/003-market-history.sql')
const model = read('../prisma-market-data/rehearsals/zsrir-e2-t01/schema.sql')
const writer = read('../prisma-market-data/private-write/004-zsrir-history.sql')
const reader = read('../prisma-market-data/private-read/001-stored-history-read.sql')
const coreFixture = `
  CREATE TABLE public.market_series (id text PRIMARY KEY, "providerCode" text NOT NULL, "providerSeriesId" text NOT NULL,
    "providerSeriesKey" text, "displayName" text NOT NULL, frequency text, currency text, unit text, "sourceLabel" text,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" timestamp(3) NOT NULL,
    UNIQUE("providerCode","providerSeriesId"));
  CREATE TABLE public.market_observations (id text PRIMARY KEY, "seriesId" text NOT NULL REFERENCES public.market_series(id),
    "observedAt" timestamp(3) NOT NULL, value numeric(24,8), "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL, UNIQUE("seriesId","observedAt"));
  CREATE TABLE public.market_hydration_state (id text PRIMARY KEY, "seriesId" text NOT NULL UNIQUE REFERENCES public.market_series(id));
`

const sourceId = 'sg2.market.zsrir.history.persist'
const roles = {owner:'profitia_ingestion_owner', projection:'profitia_market_read_owner',
  stage:'zsrir_synthetic_stage', publish:'zsrir_synthetic_publish', read:'zsrir_synthetic_read',
  macrobond:'zsrir_synthetic_macrobond'}

async function transaction(client, work, rollback = false) {
  await client.query('BEGIN')
  try {
    const value = await work()
    await client.query(rollback ? 'ROLLBACK' : 'COMMIT')
    return value
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function connection() {
  const database = 'sg2_zsrir_model_test'
  const neon = process.env.SG2_ZSRIR_NEON_TEST_TARGET
  const supplied = process.env.SG2_ZSRIR_TEST_URL
  if (!supplied && !neon) {
    const rootUrl = assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')
    const root = new Client({connectionString:rootUrl})
    const name = 'sg2_zsrir_' + randomUUID().replaceAll('-','')
    await root.connect()
    try {
      const address = (await root.query('SELECT host(inet_server_addr()) AS host')).rows[0].host
      assert.ok(['127.0.0.1','::1'].includes(address))
      await root.query('CREATE DATABASE '+name)
    } catch (error) {
      await root.end()
      throw error
    }
    const url = new URL(rootUrl)
    url.pathname = '/' + name
    return {url, root, database:name}
  }
  let url
  try { url = new URL(supplied) } catch { throw Error('Explicit ZSRIR rehearsal connection required') }
  assert.equal(url.protocol,'postgresql:')
  if (!neon) {
    assert.equal(url.hostname, '127.0.0.1')
    assert.equal(url.username, 'architecture_test_owner')
    assert.equal(url.password, 'isolated_ci_only')
    assert.equal(url.pathname, '/' + database)
    assert.ok(url.port && !url.search && !url.hash)
    return {url,database}
  }
  const receipt = JSON.parse(neon)
  assert.equal(receipt.projectName, 'sg2-zsrir-e2-t01-rehearsal')
  assert.match(receipt.projectId, /^[a-z]+-[a-z]+-\d+$/)
  assert.notEqual(receipt.projectId, 'autumn-waterfall-65938876')
  assert.match(receipt.branchId, /^br-[a-z0-9-]+$/)
  assert.match(receipt.computeId, /^ep-[a-z0-9-]+$/)
  assert.match(receipt.challenge, /^[a-f0-9]{64}$/)
  assert.equal(url.pathname, '/' + database)
  assert.equal(url.hostname, receipt.hostname)
  assert.equal(url.hostname.split('.')[0], receipt.computeId)
  assert.match(url.hostname, /\.eu-central-1\.aws\.neon\.tech$/)
  assert.equal(url.searchParams.get('sslmode'), 'verify-full')
  return {url, receipt, database}
}

function ref(revision = 'synthetic-original', classification = 'BEFORE_OR_AT_CUTOFF') {
  return {provider_code:'ZSRIR', publisher_code:'MRIRW', channel_code:'GOV_PL', report_type:'BULLETIN',
    publication_ref:'synthetic-edition-' + revision, artifact_ref:'synthetic-xlsx-' + revision, revision_ref:revision,
    sha256:hash(revision), locator:{sheet:'SYNTHETIC',table:1,cell:'B2'},
    source_unit:'PLN/t', source_value:'1.25', conversion:'IDENTITY',
    publication_time:{source_text:'2026-10-27',source_date:'2026-10-27',precision:'DATE',timezone:'Europe/Warsaw',classification,
      evidence:{field:'Publication',edition_ref:'SYNTHETIC_ONLY'}}}
}

const series = 'zsrir:v1:' + hash(JSON.stringify(['SYNTH','SYNTH_A','PURCHASE','PL','WEEKLY','PLN/t','PLN','AS_PUBLISHED']))
const fixture = {provider_code:'ZSRIR',provider_series_id:series, category_code:'FOOD',display_name:'Synthetic',
  market_code:'SYNTH',product_code:'SYNTH_A',metric_code:'PURCHASE',geography_code:'PL',frequency:'WEEKLY',unit:'PLN/t',currency:'PLN',
  aggregation_code:'AS_PUBLISHED',period_start:'2026-10-19',period_end:'2026-10-25',observed_at:'2026-10-25',value:'1.25',
  provenance:[ref(),{...ref(),channel_code:'ZSRIR_PORTAL',artifact_ref:'synthetic-other-channel'}],
  normalization_version:'zsrir-e1-t03-v1.0',revision:1,revision_ref:'sha256:'+hash('r1')}

test('controlled ZSRIR staging, Source publication and read separation on an isolated SG2 database', async t => {
  const {url,receipt,root,database} = await connection()
  const admin = new Client({connectionString:url.href})
  const sessions = []
  const approvedRoles = []
  const query = (sql, params) => admin.query(sql, params)
  const execute = (client, sql, params) => client.query(sql, params).then(result => result.rows[0]?.value)
  const qualifiedSha = hash('synthetic-only-qualified-snapshot')
  const denied = promise => assert.rejects(promise, {code:'42501'})
  let initialized = false
  try {
    await admin.connect()
    const actual = (await query("SELECT current_database() db,session_user admin,host(inet_server_addr()) host,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) tls")).rows[0]
    assert.equal(actual.db, database)
    assert.equal(actual.admin, decodeURIComponent(url.username))
    if (!receipt) assert.ok(['127.0.0.1','::1'].includes(actual.host))
    if (receipt) {
      assert.equal(actual.tls, true)
      const marker = (await query('SELECT project_id,branch_id,compute_id,challenge FROM public.sg2_zsrir_rehearsal_identity')).rows
      assert.deepEqual(marker,[{project_id:receipt.projectId,branch_id:receipt.branchId,compute_id:receipt.computeId,challenge:receipt.challenge}])
    }
    if (root) await query(coreFixture)
    const baseline = (await query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')")).rows[0].n
    assert.equal(baseline, receipt ? 4 : 3)
    for (const name of ['market_series','market_observations','market_hydration_state']) {
      assert.equal((await query('SELECT count(*)::int n FROM public.'+name)).rows[0].n,0)
    }
    assert.equal((await query("SELECT to_regnamespace('profitia_market_history') name")).rows[0].name,null)

    await t.test('period migration replays, then rolls back to the original schema', async () => {
      await transaction(admin, async () => {
        await query(model)
        await query(model)
        assert.equal((await query("SELECT to_regclass('public.market_period_observation_revisions') IS NOT NULL present")).rows[0].present,true)
      }, true)
      assert.equal((await query("SELECT to_regclass('public.market_period_observation_revisions') name")).rows[0].name,null)
    })

    const password = randomBytes(24).toString('hex')
    for (const [use, login] of Object.entries(roles)) {
      const interactive = !['owner','projection'].includes(use)
      const exists = (await query('SELECT rolcanlogin,rolinherit,rolbypassrls,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1',[login])).rows[0]
      if (exists) {
        assert.ok(root && !interactive)
        assert.deepEqual(Object.values(exists), [false,false,false,false,false,false])
      } else {
        await query('CREATE ROLE '+login+' NOINHERIT NOCREATEDB NOCREATEROLE '+(interactive ? "LOGIN CONNECTION LIMIT 1 PASSWORD '"+password+"'" : 'NOLOGIN'))
        approvedRoles.push(login)
      }
    }
    initialized = true
    const adminRole = '"' + actual.admin.replaceAll('"','""') + '"'
    if (receipt) await query('GRANT '+roles.owner+','+roles.projection+' TO '+adminRole+' WITH SET TRUE')
    await query('GRANT CREATE ON DATABASE '+database+' TO '+roles.owner+','+roles.projection)
    await query('GRANT SELECT,INSERT,UPDATE ON public.market_series,public.market_observations,public.market_hydration_state TO '+roles.owner)
    await query('GRANT SELECT ON public.market_series,public.market_observations TO '+roles.projection)
    const project = receipt?.projectId ?? 'isolated-local-zsrir'
    const branch = receipt?.branchId ?? 'isolated-local-zsrir-branch'
    await transaction(admin, async () => {
      await query(model)
      await query('GRANT SELECT,INSERT ON public.market_period_observation_revisions TO '+roles.owner)
      await query('GRANT SELECT ON public.market_period_observation_revisions TO '+roles.projection)
      await query('SET LOCAL ROLE '+roles.owner)
      await query(sourceSql)
      await query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development',$2,$3,current_database())",[hash(sourceSql),project,branch])
      await query(externalSql)
      await query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development',$3,$4,current_database())",[hash(externalSql), hash(sourceSql),project,branch])
      await query(nativeSql)
      await query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(nativeSql)])
      await query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[hash(unmeteredSql)])
      await query(unmeteredSql)
      await query(boundary)
      await query(writer)
      await query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'spendguru-market-history','PLATFORM_INTERNAL','synthetic-development','v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[roles.publish,randomUUID(),randomUUID()])
      await query("INSERT INTO profitia_ingestion.sources VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','zsrir-v1','zsrir-v1','v1','source-receipt-v1','ACTIVE',1,'SYNTHETIC_ONLY',now()+interval '1 hour')",[sourceId])
      await query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),roles.publish,sourceId,series])
      await query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'spendguru-market-history',$2,'SOURCE_TRANSACTION',40,now()-interval '1 hour',now()+interval '2 hours',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),sourceId])
      await query('GRANT USAGE ON SCHEMA profitia_market_history TO '+roles.stage+','+roles.publish)
      await query('GRANT USAGE ON SCHEMA profitia_ingestion TO '+roles.publish)
      await query('GRANT EXECUTE ON FUNCTION profitia_market_history.stage_zsrir_history(text,jsonb) TO '+roles.stage)
      await query('GRANT EXECUTE ON FUNCTION profitia_market_history.apply_zsrir_history(uuid,uuid,text),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.reserve(text,text,text,text,uuid) TO '+roles.publish)
      await query('RESET ROLE')
      await query('SET LOCAL ROLE '+roles.projection)
      await query(reader)
      await query('CREATE VIEW profitia_market_read.zsrir_synthetic_projection WITH(security_barrier=true) AS SELECT "providerSeriesId","periodStart"::text,"periodEnd"::text,revision,value,provenance FROM public.market_period_observation_revisions')
      await query('GRANT USAGE ON SCHEMA profitia_market_read TO '+roles.read+','+roles.macrobond)
      await query('GRANT SELECT ON profitia_market_read.zsrir_synthetic_projection TO '+roles.read)
      await query('GRANT SELECT ON profitia_market_read.series,profitia_market_read.observations TO '+roles.macrobond)
    })
    const login = async name => {
      const direct = new URL(url)
      direct.username = name
      direct.password = password
      const client = new Client({connectionString:direct.href})
      await client.connect()
      sessions.push(client)
      assert.equal(await execute(client,'SELECT session_user AS value'),name)
      return client
    }
    const stage = await login(roles.stage), publisher = await login(roles.publish)
    const zsrirRead = await login(roles.read), macrobondRead = await login(roles.macrobond)
    const stageRows = (rows, snapshot=qualifiedSha) => execute(stage,'SELECT profitia_market_history.stage_zsrir_history($1,$2::jsonb) AS value',[snapshot,JSON.stringify(rows)])
    const readZsrir = () => zsrirRead.query('SELECT * FROM profitia_market_read.zsrir_synthetic_projection ORDER BY "periodStart",revision').then(r=>r.rows)

    async function envelope(snapshot) {
      const grouped = await transaction(admin, async () => {
        await query('SET LOCAL ROLE '+roles.owner)
        return (await query("SELECT count(*) count, string_agg(row_sha,E'\\n' ORDER BY period_start,period_end,revision) hashes FROM profitia_market_history.zsrir_staging WHERE series_id=$1 AND snapshot_sha=$2",[series,snapshot])).rows[0]
      })
      return {sourceId,content:{schema_version:'1.0.0',snapshot_sha256:snapshot,series_id:series,row_count:Number(grouped.count), rows_sha256:hash(grouped.hashes)}}
    }

    async function publish(payload, idempotency, rollback = false) {
      const json = JSON.stringify(payload), decision = randomUUID()
      return transaction(publisher, async () => {
        const state = await execute(publisher,'SELECT profitia_ingestion.current_state($1,$2) AS value',[sourceId,series])
        assert(state)
        assert(await execute(publisher,'SELECT profitia_ingestion.lock_ingestion($1,$2,$3) AS value',[sourceId,series,state.serviceBindingVersion]))
        const reserved = await execute(publisher,'SELECT profitia_ingestion.reserve($1,$2,$3,$4,$5) AS value',[sourceId,series,hash(json),hash(idempotency),decision])
        assert(reserved)
        if (reserved.status !== 'NEW') return reserved
        return execute(publisher,'SELECT profitia_market_history.apply_zsrir_history($1,$2,$3) AS value',[reserved.effectId,decision,json])
      },rollback)
    }

    await t.test('validates complete provenance and canonical identity before writes', async () => {
      assert.equal(await stageRows([fixture,{...fixture,period_start:'2026-10-20',value:'2.5'}]),2)
      assert.equal(await stageRows([fixture]),0)
      await assert.rejects(stageRows([{...fixture,value:'2.75'}]),{code:'23505'})
      for (const bad of [
        {...fixture,provider_code:'MACROBOND'}, {...fixture,unit:'PLN/kg'}, {...fixture,period_end:'2026-02-30'},
        {...fixture,value:'1.000000001'}, {...fixture,observed_at:'2026-10-24'},
        {...fixture,provenance:[]}, {...fixture,provenance:[{...ref(),publisher_code:'OTHER'}]},
        {...fixture,provenance:[{...ref(),locator:{sheet:'A'}}]},
        {...fixture,provenance:[ref('undated','NEEDS_DATE_REVIEW')]},
      ]) await assert.rejects(stageRows([bad],hash('invalid')), {code:'22023'})
      assert.deepEqual(await readZsrir(),[])
    })

    await t.test('requires an exact Source effect, digest and complete transaction', async () => {
      await denied(execute(publisher,"SELECT profitia_market_history.apply_zsrir_history(NULL,NULL,'{}') AS value"))
      const e = await envelope(qualifiedSha)
      const wrong = structuredClone(e)
      wrong.content.rows_sha256 = hash('unrelated')
      await assert.rejects(publish(wrong,'wrong-digest'),{code:'22023'})
      assert.equal((await publish(e,'rolled-back',true)).writtenCount,2)
      assert.deepEqual(await readZsrir(),[])
      assert.equal((await publish(e,'initial')).writtenCount,2)
      assert.equal((await publish(e,'initial')).status,'REPLAY')
      assert.equal((await publish(e,'initial-new-effect')).writtenCount,0)
      const data = await readZsrir()
      assert.deepEqual(data.map(x=>[x.periodStart,x.periodEnd,x.value]),[
        ['2026-10-19','2026-10-25','1.25000000'],['2026-10-20','2026-10-25','2.50000000']])
      assert.deepEqual(data[0].provenance,fixture.provenance)
    })

    await t.test('retains corrections and refuses conflicts or unrelated predecessors', async () => {
      const correction = {...fixture,value:'3.125',revision:2,supersedes_revision:1,revision_ref:'sha256:'+hash('r2'),
        provenance:[ref('synthetic-correction','AFTER_CUTOFF')],correction:{kind:'VALUE_CORRECTION',
          previous_revision_ref:fixture.revision_ref,source_revision_ref:'synthetic-correction'}}
      const conflict = hash('qualified-conflict')
      await stageRows([{...fixture,value:'42'}],conflict)
      await assert.rejects(publish(await envelope(conflict),'different-value'),{code:'23505'})
      const wrong = hash('wrong-predecessor')
      await stageRows([{...correction,correction:{...correction.correction,previous_revision_ref:'sha256:'+hash('other')}}],wrong)
      await assert.rejects(publish(await envelope(wrong),'wrong-predecessor'),{code:'23505'})
      const corrected = hash('corrected')
      await stageRows([correction],corrected)
      assert.equal((await publish(await envelope(corrected),'correction')).writtenCount,1)
      assert.deepEqual((await readZsrir()).map(x=>[x.revision,x.value]),[[1,'1.25000000'],[2,'3.12500000'],[1,'2.50000000']])
    })

    await t.test('ordinary roles cannot cross stage, publish or projection, and Macrobond keys stay independent', async () => {
      for (const client of [stage,publisher,zsrirRead,macrobondRead]) {
        await denied(client.query('SELECT * FROM profitia_market_history.zsrir_staging'))
        await denied(client.query('UPDATE public.market_observations SET value=999'))
        await denied(client.query('SELECT * FROM public.market_period_observation_revisions'))
      }
      await denied(stage.query("SELECT profitia_market_history.apply_zsrir_history(NULL,NULL,'{}')"))
      await denied(publisher.query("SELECT profitia_market_history.stage_zsrir_history(NULL,'[]')"))
      await denied(macrobondRead.query('SELECT * FROM profitia_market_read.zsrir_synthetic_projection'))
      await denied(zsrirRead.query('SELECT * FROM profitia_market_read.observations'))
      await transaction(admin, async () => {
        await query('SET LOCAL ROLE '+roles.owner)
        await query("INSERT INTO public.market_series(id,\"providerCode\",\"providerSeriesId\",\"displayName\",\"updatedAt\") VALUES ('synthetic-macrobond','MACROBOND',$1,'Synthetic',now())",[series])
        for (const val of [11,12]) {
          await query("INSERT INTO public.market_observations(id,\"seriesId\",\"observedAt\",value,\"updatedAt\") VALUES('synthetic-value','synthetic-macrobond','2026-10-25',$1,now()) ON CONFLICT(\"seriesId\",\"observedAt\") DO UPDATE SET value=excluded.value",[val])
        }
      })
      const observed = await macrobondRead.query('SELECT "providerSeriesId",value FROM profitia_market_read.observations')
      assert.deepEqual(observed.rows,[{providerSeriesId:series,value:'12.00000000'}])
      assert.equal((await readZsrir()).length,3)
    })
  } finally {
    await Promise.all(sessions.map(client=>client.end()))
    if (initialized) {
      // This database and these roles were proven synthetic before the first write.
      await query('DROP SCHEMA IF EXISTS profitia_market_read,profitia_market_history,profitia_external_native,profitia_external_call,profitia_ingestion CASCADE')
      await query('DROP VIEW IF EXISTS public.market_period_observations')
      await query('DROP TABLE IF EXISTS public.market_period_observation_revisions')
      await query('ALTER TABLE public.market_series DROP COLUMN IF EXISTS "zsrirDimensions"')
      await query('TRUNCATE public.market_hydration_state,public.market_observations,public.market_series')
      for (const login of approvedRoles) {
        await query('DROP OWNED BY '+login)
        await query('DROP ROLE '+login)
      }
    }
    await admin.end()
    if (root) {
      try { await root.query('DROP DATABASE '+database) } finally { await root.end() }
    }
  }
})
