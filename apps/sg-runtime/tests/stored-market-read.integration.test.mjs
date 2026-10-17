import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import test from 'node:test'
import {PrismaClient} from '@prisma/client'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {createStoredMarketHistoryReader} from '../lib/market-data/stored-read.ts'
import {getBenchmarkPreview} from '../lib/benchmark/service.ts'
import {projectMarketPreviewResponse,MARKET_PREVIEW_PROJECTION} from '../lib/platform/market-preview.ts'
const pg=createRequire(new URL('../../architecture-lab/package.json',import.meta.url))('pg')
const DATABASE='sg2_market_read_test',ROLE='sg2_stored_market_test_reader',OWNER='profitia_market_read_owner'
const sql=fs.readFileSync(new URL('../prisma-market-data/private-read/001-stored-history-read.sql',import.meta.url),'utf8')
const digest=createHash('sha256').update(sql).digest('hex')
test('stored market source uses actual ordinary read-only SQL, closed source projections and bounded native driver',async t=>{
  const root=new pg.Client({connectionString:assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')});await root.connect()
  let owner,prisma
  const originalFetch=globalThis.fetch;let external=0
  globalThis.fetch=async()=>{external++;throw Error('No source vendor calls')}
  try{
    if(!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount)await root.query(`CREATE DATABASE ${DATABASE}`)
    for(const[role,login]of[[OWNER,false],[ROLE,true]]){
      if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
      const flags=(await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0]
      assert.deepEqual(flags,{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
    }
    await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 1`)
    const url=new URL(process.env.SG2_OPERATION_TEST_OWNER_URL);url.pathname=`/${DATABASE}`
    owner=new pg.Client({connectionString:url.toString()});await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db,DATABASE)
    await owner.query('DROP SCHEMA IF EXISTS profitia_market_read CASCADE; DROP TABLE IF EXISTS public.market_observations,public.market_series,public.synthetic_private CASCADE')
    await owner.query(`CREATE TABLE public.market_series("id" text PRIMARY KEY,"providerCode" text,"providerSeriesId" text,"providerSeriesKey" text,"displayName" text,"frequency" text,"currency" text,"unit" text,"sourceLabel" text);
      CREATE TABLE public.market_observations("seriesId" text,"observedAt" timestamp,"value" numeric(24,8));CREATE TABLE public.synthetic_private(secret text);
      INSERT INTO public.synthetic_private VALUES('SYNTHETIC_PRIVATE');
      INSERT INTO public.market_series VALUES('one','MACROBOND','stored_series',null,'Stored source','monthly',null,'UNSUPPORTED_SOURCE_UNIT','Synthetic'),('other','UNAPPROVED','foreign_series',null,'Closed provider',null,null,null,null);
      INSERT INTO public.market_observations VALUES('one','2025-01-01',10),('one','2025-02-01',0),('one','2025-03-01',null),('other','2025-01-01',999);
      GRANT CREATE ON DATABASE ${DATABASE} TO ${OWNER};GRANT USAGE ON SCHEMA public TO ${OWNER};
      GRANT SELECT ON public.market_series,public.market_observations TO ${OWNER}`)
    await t.test('exact additive source DDL rolls back completely then reapplies',async()=>{
      await owner.query('BEGIN');await owner.query(`SET LOCAL ROLE ${OWNER}`)
      try{await owner.query(sql);await owner.query("DO $$ BEGIN RAISE EXCEPTION 'synthetic_stored_source_failure'; END $$");assert.fail('Expected forced failure')}
      catch(error){assert.match(error.message,/synthetic_stored_source_failure/)}finally{await owner.query('ROLLBACK')}
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_market_read')::text AS schema")).rows[0].schema,null)
    })
    await owner.query('BEGIN');await owner.query(`SET LOCAL ROLE ${OWNER}`);await owner.query(sql)
    await owner.query("INSERT INTO profitia_market_read.installation VALUES(true,'1.0.0',$1,'isolated-market-project','isolated-market-branch',$2,$3,'SYNTHETIC_NOT_A_RELEASE',now()+interval '1 hour')",[digest,DATABASE,ROLE]);await owner.query('COMMIT')
    await owner.query(`GRANT USAGE ON SCHEMA profitia_market_read TO ${ROLE};GRANT SELECT ON profitia_market_read.installation,profitia_market_read.series,profitia_market_read.observations TO ${ROLE}`)
    const runtime=new URL(url);runtime.username=ROLE;runtime.password='isolated_ci_only';runtime.searchParams.set('connection_limit','1');runtime.searchParams.set('schema','profitia_market_read')
    prisma=new PrismaClient({datasources:{db:{url:runtime.toString()}}})
    const binding={projectId:'isolated-market-project',branchId:'isolated-market-branch',databaseName:DATABASE,role:ROLE,schemaDigest:digest}
    const read=createStoredMarketHistoryReader(prisma,binding)
    await t.test('ordinary login reaches shared facts through views, preserves null/zero/unit and actual preview formatter',async()=>{
      const data=await read('stored_series');assert.deepEqual(data.history.historical.map(p=>p.value),[10,0,null])
      assert.equal(data.history.unit,'UNSUPPORTED_SOURCE_UNIT');assert.equal(data.history.currency,null)
      const preview=await getBenchmarkPreview('stored_series','ALL',read)
      assert.equal(preview.latestValue,0);assert.equal(preview.historical.length,3)
      const payload={seriesName:'stored_series',range:'ALL'}
      const resource={id:'market-history:stored_series',type:'market_knowledge',dataClass:'SHARED_KNOWLEDGE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version:MARKET_PREVIEW_PROJECTION,projectionVersion:MARKET_PREVIEW_PROJECTION,approvedSharedProjection:true}
      await projectMarketPreviewResponse(Response.json(preview),{payload,resource})
    })
    await t.test('unapproved provider and missing series remain absent, without zero-filled data or fallback',async()=>{
      for(const id of ['foreign_series','missing_series'])await assert.rejects(read(id),error=>error.code==='STORED_HISTORY_NOT_AVAILABLE'&&error.status===404)
    })
    await t.test('role cannot read private/base data, mutate projections/receipt or create authority',async()=>{
      for(const query of ['SELECT * FROM public.synthetic_private','SELECT * FROM public.market_series','UPDATE public.market_observations SET value=999','UPDATE profitia_market_read.installation SET source_ref=\'forged\'','DELETE FROM profitia_market_read.series','CREATE TABLE profitia_market_read.unauthorised(id integer)'])await assert.rejects(prisma.$executeRawUnsafe(query))
      assert.equal((await owner.query('SELECT "value"::text AS v FROM public.market_observations WHERE "seriesId"=\'one\' ORDER BY "observedAt"')).rows[0].v,'10.00000000')
    })
    await t.test('even accidental base/private SELECT or source DML grant makes reader refuse',async()=>{
      for(const target of ['public.market_series','public.synthetic_private']){
        await owner.query(`GRANT SELECT ON ${target} TO ${ROLE}`)
        try{await assert.rejects(read('stored_series'),error=>error.code==='STORED_SOURCE_UNAVAILABLE')}
        finally{await owner.query(`REVOKE SELECT ON ${target} FROM ${ROLE}`)}
      }
      await owner.query(`GRANT UPDATE ON profitia_market_read.installation TO ${ROLE}`)
      try{await assert.rejects(read('stored_series'),error=>error.code==='STORED_SOURCE_UNAVAILABLE')}
      finally{await owner.query(`REVOKE UPDATE ON profitia_market_read.installation FROM ${ROLE}`)}
    })
    await t.test('column-only private/base SELECT cannot hide behind a false table-level privilege result',async()=>{
      for(const[target,column]of[['public.synthetic_private','secret'],['public.market_series','displayName']]){
        await owner.query(`GRANT SELECT("${column}") ON ${target} TO ${ROLE}`)
        try{
          const actual=(await prisma.$queryRawUnsafe("SELECT has_table_privilege(current_user,$1,'SELECT') AS table_select,has_any_column_privilege(current_user,$1,'SELECT') AS column_select",target))[0]
          assert.deepEqual(actual,{table_select:false,column_select:true})
          await assert.rejects(read('stored_series'),error=>error.code==='STORED_SOURCE_UNAVAILABLE'&&error.status===503)
        }finally{await owner.query(`REVOKE SELECT("${column}") ON ${target} FROM ${ROLE}`)}
      }
      assert.equal((await read('stored_series')).history.historical.length,3)
    })
    await t.test('column-only source writes, references and delegation privileges are refused before data reads',async()=>{
      for(const[grant,revoke]of[
        [`GRANT INSERT(source_ref) ON profitia_market_read.installation TO ${ROLE}`,`REVOKE INSERT(source_ref) ON profitia_market_read.installation FROM ${ROLE}`],
        [`GRANT UPDATE(source_ref) ON profitia_market_read.installation TO ${ROLE}`,`REVOKE UPDATE(source_ref) ON profitia_market_read.installation FROM ${ROLE}`],
        [`GRANT REFERENCES(source_ref) ON profitia_market_read.installation TO ${ROLE}`,`REVOKE REFERENCES(source_ref) ON profitia_market_read.installation FROM ${ROLE}`],
        [`GRANT SELECT(source_ref) ON profitia_market_read.installation TO ${ROLE} WITH GRANT OPTION`,`REVOKE SELECT(source_ref) ON profitia_market_read.installation FROM ${ROLE}`],
      ]){await owner.query(grant);try{await assert.rejects(read('stored_series'),error=>error.code==='STORED_SOURCE_UNAVAILABLE')}finally{await owner.query(revoke)}}
      assert.equal((await read('stored_series')).history.historical.length,3)
    })
    await t.test('source schema CREATE and runtime replication drift cannot become source authority',async()=>{
      for(const[change,restore]of[
        [`GRANT CREATE ON SCHEMA profitia_market_read TO ${ROLE}`,`REVOKE CREATE ON SCHEMA profitia_market_read FROM ${ROLE}`],
        [`ALTER ROLE ${ROLE} REPLICATION`,`ALTER ROLE ${ROLE} NOREPLICATION`],
      ]){await owner.query(change);try{await assert.rejects(read('stored_series'),error=>error.code==='STORED_SOURCE_UNAVAILABLE')}finally{await owner.query(restore)}}
      assert.equal((await read('stored_series')).history.historical.length,3)
    })
    await t.test('actual source transaction is READ ONLY before every source SELECT',async()=>{
      const update='UPDATE public.market_observations SET value=999'
      await owner.query(`GRANT UPDATE ON public.market_observations TO ${ROLE}`)
      try{await assert.rejects(prisma.$transaction(async transaction=>{await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');await transaction.$executeRawUnsafe(update)}),error=>error.meta?.code==='25006')}
      finally{await owner.query(`REVOKE UPDATE ON public.market_observations FROM ${ROLE}`)}
    })
    await t.test('foreign bindings, malformed digest and expired receipt refuse independently of stored values',async()=>{
      for(const patch of [{projectId:'foreign-project'},{branchId:'foreign-branch'},{databaseName:'foreign_db'},{role:'foreign_role'},{schemaDigest:'0'.repeat(64)}])await assert.rejects(createStoredMarketHistoryReader(prisma,{...binding,...patch})('stored_series'))
      await owner.query("UPDATE profitia_market_read.installation SET expires_at=now()-interval '1 second'")
      try{await assert.rejects(read('stored_series'),error=>error.code==='STORED_SOURCE_UNAVAILABLE')}
      finally{await owner.query("UPDATE profitia_market_read.installation SET expires_at=now()+interval '1 hour'")}
      await assert.rejects(read('*'),error=>error.status===400)
    })
    assert.equal(external,0)
    assert((await owner.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename=$1',[ROLE])).rows[0].n<=1)
  }finally{globalThis.fetch=originalFetch;await prisma?.$disconnect();await owner?.end();await root.end()}
})
