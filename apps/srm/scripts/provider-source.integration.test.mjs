import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import pg from 'pg'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { createSrmProviderSourceTransport, createSrmMsrSourceTransport, srmProviderSourcePolicy, SRM_MSR_STORAGE_ORIGIN } from '../src/server/provider-source-transport.ts'
import { downloadMsrOriginal } from '../src/server/msr-source.ts'
import { fetchMgbiGeneral } from '../src/server/mgbi-general.ts'
import { fetchMgbiFinancial } from '../src/server/mgbi-financial.ts'
import { fetchMgbiPages } from '../src/server/mgbi-archive.ts'
import { fetchVerclyKys } from '../src/server/vercly-kys.ts'
import { fetchCeidgJdg } from '../src/server/integrations/ceidg.ts'

const DATABASE = 'srm_provider_' + randomUUID().replaceAll('-', ''), ROLE = 'srm_source_fixture'
const NIP = '5272443955', OTHER = '5260250274', CREDENTIAL = 'synthetic-provider-credential'
const MSR_RECORD='d'.repeat(24),MSR_FILE=`https://api.mgbi.pl/v1/models/pl-krs-rdf-record/records/${MSR_RECORD}/files/main_document_uri`
const STORAGE_URL=SRM_MSR_STORAGE_ORIGIN+'/fixture/one.xhtml?fixture-signature=synthetic-only'
const hash = value => createHash('sha256').update(value).digest('hex'), key = () => randomBytes(32).toString('hex')
const readSql = name => fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/' + name, import.meta.url), 'utf8')
const rootSql = readSql('008-platform-ingestion.sql'), callSql = readSql('009-external-call-admission.sql'), nativeSql = readSql('012-native-external-transport.sql')
const rootDigest = hash(rootSql), callDigest = hash(callSql), nativeDigest = hash(nativeSql)
// Native TS consumers and ESM tests may load separate module instances. Check
// the closed public failure contract rather than cross-loader class identity.
const unavailable = error => error instanceof Error && error.name === 'ExternalCallUnavailable'
  && ['NOT_SENT', 'UNVERIFIED', 'RESULT_NOT_RETAINED'].includes(error.certainty)
  && error.retryAllowed === false && error.message === 'External result unavailable'
const mgbiUrl = (nip = NIP, page = 1) => `https://api.mgbi.pl/v1/models/pl-krs-wp-record/records?identifiers.pl_nip=${nip}&per_page=100&page=${page}`

test('native provider source adoption pins original clients and keeps live release boundaries explicit', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../operation-integration.json', import.meta.url)))
  const current = manifest.nativeProviderSourceAdoption
  assert.equal(current.version, 'srm-native-provider-source-v1')
  assert.equal(current.previousNativeSourceRecordIsHistorical, true)
  assert.equal(current.originalProviderClientsReused, true); assert.equal(current.ordinaryNativePgDriverShared, true)
  assert.equal(Object.keys(current.sourceDigests).length, 8)
  assert.equal(current.sourceRecordIsHistorical,true)
  const adoption=manifest.nativeMsrProviderSourceAdoption
  assert.equal(adoption.taskId,'SRM-E1-MSR-NATIVE-SOURCE-TRANSPORT-20261019')
  assert.equal(adoption.previousProviderSourceReceiptPreserved,true)
  assert.equal(Object.keys(adoption.sourceDigests).length,9)
  const latest=manifest.nativeSensitiveSupplierCompositionAdoption
  for(const[path,digest]of Object.entries(adoption.sourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+path,import.meta.url))),latest.sourceDigests[path]??digest,path)
  for (const [path, digest] of Object.entries(current.sourceDigests)) {
    const expected=latest.sourceDigests[path]??adoption.sourceDigests[path]??digest
    assert.equal(hash(fs.readFileSync(new URL('../' + path, import.meta.url))),expected,path)
  }
  for (const key of ['humanSupplierRefreshAdopted', 'sharedCatalogWriteAdopted', 'msrFilesAdopted', 'krsFilesAdopted', 'liveSqlInstalled', 'runtimeRoleOrGrantChanged', 'productDeploymentPerformed']) assert.equal(current[key], false, key)
})

test('original SRM clients use ordinary-role native source controls without a second provider engine', async t => {
  const rootUrl = assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL, 'srm_app', 'architecture_test_owner')
  const root = new pg.Client({ connectionString: rootUrl }); await root.connect()
  let owner, pool, auditPool, server, onRequest = null, mode = 'NORMAL', hits = 0
  const observed = [], operationKeys = [], storedCorrelation = 'correlation123'
  const generalRecord = { id: 'a'.repeat(24), identifiers: { pl_nip: NIP, pl_krs: '0000217580' },
    content: { current_excerpt: { naglowekA: {}, dane: { dzial1: { danePodmiotu: { nazwa: 'Synthetic Company', formaPrawna: 'SPÓŁKA AKCYJNA' } } } } } }
  const dbUrl = new URL(rootUrl); dbUrl.pathname = '/' + DATABASE
  try {
    server = http.createServer(async (req, res) => {
      hits++; let body = ''; for await (const part of req) body += part
      observed.push({ path: req.url, method: req.method, authorization: req.headers.authorization, body })
      const current = onRequest; onRequest = null; if (current) await current()
      if (mode === 'DISCONNECT') { req.socket.destroy(); return }
      if (mode === 'EMPTY_204') { res.statusCode = 204; res.end(); return }
      res.setHeader('content-type', 'application/json'); res.setHeader('x-private', 'never-forward')
      const url = new URL(req.url, 'http://127.0.0.1')
      if (mode === 'REDIRECT') { res.statusCode = 302; res.setHeader('location', 'https://unapproved.invalid/report'); res.end('{}'); return }
      if (mode.startsWith('MSR_')) {
        if (url.pathname.endsWith('/limits')) {
          if (mode==='MSR_LIMITS_REDIRECT') {res.statusCode=302;res.setHeader('location',STORAGE_URL);res.end('');return}
          res.end(JSON.stringify({max:{files:1},used:{files:mode==='MSR_BUDGET'?1:0}}));return
        }
        if (mode==='MSR_DROP' && url.pathname.includes('/files/')) {req.socket.destroy();return}
        if (url.pathname.includes('/files/') && /REDIRECT|CHAIN|FOREIGN/.test(mode)) {
          res.statusCode=302;res.setHeader('location',mode==='MSR_FOREIGN'?'https://unapproved.invalid/file':STORAGE_URL);res.end('');return
        }
        if (url.pathname.startsWith('/fixture/') && /CHAIN/.test(mode)) {
          const step=url.pathname.match(/\/(one|two|three|four)\.xhtml$/)?.[1]
          if (step==='one' || mode==='MSR_CHAIN_EXCESS') {
            const next={one:'two',two:'three',three:'four',four:'five'}[step]??'five'
            res.statusCode=307;res.setHeader('location',SRM_MSR_STORAGE_ORIGIN+'/fixture/'+next+'.xhtml?fixture-signature=synthetic-only');res.end('');return
          }
        }
        const prefix='<html><body><!--',suffix='--></body></html>',size=mode.endsWith('_MAX')?20*1024*1024:128
        const bytes=Buffer.from(prefix+'x'.repeat(size-prefix.length-suffix.length)+suffix)
        res.setHeader('content-type','application/xhtml+xml');res.setHeader('content-length',mode==='MSR_OVERSIZE'?20*1024*1024+1:bytes.length);res.end(bytes);return
      }
      if (url.pathname.startsWith('/v1/models/')) {
        if (mode === 'TWO_PAGES') res.end(JSON.stringify({ count: 2, pages: 2, results: [{ id: 'page-' + url.searchParams.get('page') }] }))
        else if (mode === 'INCOMPLETE') res.end(JSON.stringify({ count: 2, pages: 2, results: url.searchParams.get('page') === '1' ? [generalRecord] : [] }))
        else res.end(JSON.stringify({ count: url.pathname.includes('wp-record') ? 1 : 0, results: url.pathname.includes('wp-record') ? [generalRecord] : [] }))
      } else if (url.pathname === '/api/ceidg/v3/firma') res.end(JSON.stringify({ firma: [{ id: 'entry-1', nazwa: 'Synthetic JDG', wlasciciel: { nip: NIP }, status: 'AKTYWNY' }] }))
      else if (req.method === 'POST') res.end(JSON.stringify([storedCorrelation]))
      else if (mode === 'POLL_RETRY') { mode = 'NORMAL'; res.statusCode = 429; res.setHeader('retry-after', '2'); res.end('{}') }
      else res.end(JSON.stringify([{ Header: { CorrelationId: storedCorrelation, Id: 'report123' }, Body: { IsComplete: true,
        Entity: { Name: 'Synthetic Company', Ids: [{ Type: 'VatID', Value: 'PL' + NIP }] } } }]))
    })
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const origin = 'http://127.0.0.1:' + server.address().port
    assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount, 0)
    await root.query(`CREATE DATABASE ${DATABASE}`)
    await root.query("BEGIN; SET LOCAL lock_timeout='5s'; SELECT pg_advisory_xact_lock(170001,20261017)")
    try {
      for (const [role, login] of [['profitia_ingestion_owner', false], [ROLE, true]]) {
        if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await root.query(`CREATE ROLE ${role} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
        assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1', [role])).rows[0], { rolsuper: false, rolbypassrls: false, rolinherit: false, rolcanlogin: login })
      }
      await root.query('COMMIT')
    } catch (error) { await root.query('ROLLBACK'); throw error }
    owner = new pg.Client({ connectionString: dbUrl.toString() }); await owner.connect()
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_ingestion_owner; GRANT CREATE ON SCHEMA public TO profitia_ingestion_owner`)
    const controlled = async work => {
      await owner.query('BEGIN; SET LOCAL ROLE profitia_ingestion_owner')
      try { const result = await work(); await owner.query('COMMIT'); return result }
      catch (error) { await owner.query('ROLLBACK'); throw error }
    }
    await controlled(async () => {
      await owner.query(rootSql)
      await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','synthetic-provider-project','synthetic-provider-branch',$2)", [rootDigest, DATABASE])
      await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'srm-provider-source','PLATFORM_INTERNAL','synthetic-provider','source-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [ROLE, randomUUID(), randomUUID()])
      await owner.query(callSql)
      await owner.query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development','synthetic-provider-project','synthetic-provider-branch',$3)", [callDigest, rootDigest, DATABASE])
      await owner.query(nativeSql)
      await owner.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')", [nativeDigest])
      const installedSources=new Set()
      for (const provider of ['MGBI', 'VERCLY', 'CEIDG','MGBI_MSR_API','MGBI_MSR_STORAGE']) {
        const p = srmProviderSourcePolicy(provider)
        if(!installedSources.has(p.source.id)) {
        await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", Object.values(p.source))
        await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [randomUUID(), ROLE, p.source.id])
        await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'srm-provider-source',$2,'SOURCE_TRANSACTION',1000,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')", [randomUUID(), p.source.id])
        installedSources.add(p.source.id)
        }
        const policyId = randomUUID()
        await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'provider-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,8192,1048576,20000,'UPSTREAM_ATTEMPT_ADMISSION',200,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')", [policyId, ROLE, p.source.id, p.resourceId, origin, JSON.stringify(p.basePathRules)])
        const msr=provider.startsWith('MGBI_MSR_')
        await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,$3::jsonb,$4,$5,'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '30 minutes','SYNTHETIC_ONLY')", [policyId, JSON.stringify(p.pathRules),JSON.stringify(msr?[SRM_MSR_STORAGE_ORIGIN]:[]),msr?20*1024*1024:1048576,provider==='MGBI_MSR_STORAGE'?'NONE':'SERVER_HEADERS'])
      }
      await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_external_call,profitia_external_native TO ${ROLE}; GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.receipt(text,text,text,text),profitia_ingestion.append_audit(jsonb),profitia_external_call.descriptor(text,text),profitia_external_call.apply_control(uuid,uuid,text),profitia_external_call.read_status(uuid,text,text),profitia_external_native.descriptor(text,text) TO ${ROLE}`)
    })
    const runtimeUrl = new URL(dbUrl); runtimeUrl.username = ROLE; runtimeUrl.password = 'isolated_ci_only'
    pool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 4 }); auditPool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 2 })
    const application = { appId: 'srm-provider-source', environment: 'development', profileId: 'PLATFORM_INTERNAL', deploymentId: 'synthetic-provider', configurationVersion: 'source-v1', identityIssuer: 'urn:profitia:database-service-runtime:v1', organisationId: null, features: ['knowledge_ingestion'], operations: ['knowledge.ingest'] }
    const settings = provider => ({ provider, application, pool, auditPool, nip: NIP, operationKey: key(), syntheticOrigin: origin,
      providerOrigin: provider === 'MGBI' ? 'https://api.mgbi.pl' : provider === 'CEIDG' ? 'https://dane.biznes.gov.pl' : 'https://synthetic.vercly.invalid',
      binding: { applicationId: application.appId, environment: 'development', projectId: 'synthetic-provider-project', branchId: 'synthetic-provider-branch', databaseName: DATABASE, role: ROLE, deploymentId: application.deploymentId, configurationVersion: application.configurationVersion, schemaDigest: rootDigest },
      external: { configurationVersion: 'provider-v1', schemaDigest: callDigest, nativeSchemaDigest: nativeDigest, maximumResponseBytes: 1048576 },
      headers: { authorization: provider === 'MGBI' ? CREDENTIAL : 'Bearer ' + CREDENTIAL } })
    const transport = (provider, patch = {}) => { const s = { ...settings(provider), ...patch }; operationKeys.push(s.operationKey); return createSrmProviderSourceTransport(s) }
    const msrTransport=(patch={})=>{
      const {provider,providerOrigin,...base}=settings('MGBI'),options={...base,recordId:MSR_RECORD,external:{...base.external,maximumResponseBytes:20*1024*1024},...patch}
      operationKeys.push(options.operationKey);return createSrmMsrSourceTransport(options)
    }
    const counts = async () => ({ calls: (await owner.query('SELECT count(*)::int n FROM profitia_external_call.calls')).rows[0].n,
      admissions: (await owner.query('SELECT sum(admitted_count)::int n FROM profitia_external_call.policies')).rows[0].n,
      sourceTransactions: (await owner.query('SELECT sum(consumed_count)::int n FROM profitia_ingestion.budgets')).rows[0].n })

    await t.test('original corporate and financial mapping execute real HTTP and three committed controls each', async () => {
      const before = await counts(), n = hits, { fetcher } = transport('MGBI')
      const general = await fetchMgbiGeneral({ type: 'NIP', value: NIP }, { apiKey: CREDENTIAL, fetcher })
      assert.equal(general.errorCode, null); assert.equal(general.section.data.legalName, 'Synthetic Company'); assert.equal(general.rawResponse.recordCount, 1)
      const financial = await fetchMgbiFinancial({ type: 'NIP', value: NIP }, { apiKey: CREDENTIAL, fetcher })
      assert.equal(financial.errorCode, null); assert.equal(financial.section.status, 'EMPTY'); assert.equal(hits, n + 2)
      assert.deepEqual(await counts(), { calls: before.calls + 2, admissions: before.admissions + 2, sourceTransactions: before.sourceTransactions + 6 })
      assert(observed.slice(-2).every(r => r.authorization === CREDENTIAL))
    })
    await t.test('actual paginator preserves complete two-page archive and rejects incomplete provider data', async () => {
      mode = 'TWO_PAGES'
      const result = await fetchMgbiPages(new URL(mgbiUrl()), { Authorization: CREDENTIAL }, new AbortController().signal, transport('MGBI').fetcher)
      assert.equal(result.errorCode, null); assert.equal(result.pages.length, 2); assert.equal(result.count, 2)
      mode = 'INCOMPLETE'
      const incomplete = await fetchMgbiPages(new URL(mgbiUrl()), { Authorization: CREDENTIAL }, new AbortController().signal, transport('MGBI').fetcher)
      assert.equal(incomplete.errorCode, 'INCOMPLETE_RESPONSE'); assert.deepEqual(incomplete.pages, []); mode = 'NORMAL'
    })
    await t.test('original Vercly POST-once and retry-after polling use independent current admissions', async () => {
      const n = hits, waits = []; mode = 'POLL_RETRY'
      const result = await fetchVerclyKys({ identifier: { type: 'NIP', value: NIP } }, { apiKey: CREDENTIAL, baseUrl: 'https://synthetic.vercly.invalid', fetcher: transport('VERCLY').fetcher, sleep: async ms => { waits.push(ms) } })
      assert.equal(result.errorCode, null); assert.equal(result.section.data.company.nip, NIP); assert.equal(hits, n + 3)
      assert.equal(observed.slice(n).filter(r => r.method === 'POST').length, 1); assert.equal(waits.length, 2)
    })
    await t.test('original CEIDG identity matching still runs through the same source mechanism', async () => {
      const result = await fetchCeidgJdg(NIP, { token: CREDENTIAL, fetcher: transport('CEIDG').fetcher })
      assert.equal(result.errorCode, null); assert.equal(result.section.data.entries[0].nip, NIP)
    })
    await t.test('actual CEIDG empty 204 remains explicit absence without fabricating a record', async () => {
      mode = 'EMPTY_204'
      const result = await fetchCeidgJdg(NIP, { token: CREDENTIAL, fetcher: transport('CEIDG').fetcher })
      assert.equal(result.errorCode, null); assert.equal(result.section.status, 'EMPTY'); assert.equal(result.snapshot, null); mode = 'NORMAL'
    })
    await t.test('source OUTCOME failure rolls back its real PLAN before an HTTP attempt', async () => {
      const n = hits, before = await counts()
      await controlled(() => owner.query(`CREATE FUNCTION profitia_ingestion.synthetic_outcome_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'Synthetic source audit outage' USING ERRCODE='42501'; END IF; RETURN NEW; END$$; CREATE TRIGGER synthetic_outcome_failure BEFORE INSERT ON profitia_ingestion.security_events FOR EACH ROW EXECUTE FUNCTION profitia_ingestion.synthetic_outcome_failure()`))
      try { await assert.rejects(transport('MGBI').fetcher(mgbiUrl()), unavailable); assert.equal(hits, n); assert.deepEqual(await counts(), before) }
      finally { await controlled(() => owner.query('DROP TRIGGER synthetic_outcome_failure ON profitia_ingestion.security_events; DROP FUNCTION profitia_ingestion.synthetic_outcome_failure()')) }
    })
    await t.test('foreign NIP, origin, query, credential, paid body and correlation fail before network or reservation', async () => {
      const n = hits, before = await counts(), mgbi = transport('MGBI'), vercly = transport('VERCLY')
      for (const url of [mgbiUrl(OTHER), mgbiUrl() + '&private=yes', mgbiUrl() + '&page=1', mgbiUrl().replace('api.mgbi.pl', 'other.invalid'), mgbiUrl().replace('page=1', 'page=101')]) await assert.rejects(mgbi.fetcher(url), unavailable)
      await assert.rejects(mgbi.fetcher(mgbiUrl(), { headers: { authorization: 'foreign-credential' } }), unavailable)
      for (const [url, init] of [['https://synthetic.vercly.invalid/api/verifications', { method: 'POST', body: JSON.stringify([{ Id: OTHER, Country: 'PL' }]) }], ['https://synthetic.vercly.invalid/api/verifications/foreign123', {}]]) await assert.rejects(vercly.fetcher(url, init), unavailable)
      assert.equal(hits, n); assert.deepEqual(await counts(), before)
    })
    await t.test('same stable operation conflicts on changed NIP and cannot issue another paid POST', async () => {
      const operationKey = key(), original = transport('VERCLY', { operationKey }), url = 'https://synthetic.vercly.invalid/api/verifications'
      const init = { method: 'POST', body: JSON.stringify([{ Id: NIP, Country: 'PL' }]) }, n = hits
      assert.equal((await original.fetcher(url, init)).status, 200)
      await assert.rejects(original.fetcher(url, init), unavailable)
      await assert.rejects(transport('VERCLY', { operationKey }).fetcher(url, init), unavailable)
      await assert.rejects(transport('VERCLY', { operationKey, nip: OTHER }).fetcher(url, { ...init, body: JSON.stringify([{ Id: OTHER, Country: 'PL' }]) }), unavailable)
      assert.equal(hits, n + 1)
    })
    await t.test('ambiguous original Vercly POST is not retried in the same or reconstructed transport', async () => {
      const operationKey = key(), a = transport('VERCLY', { operationKey }), n = hits; mode = 'DISCONNECT'
      const result = await fetchVerclyKys({ identifier: { type: 'NIP', value: NIP } }, { apiKey: CREDENTIAL, baseUrl: 'https://synthetic.vercly.invalid', fetcher: a.fetcher, sleep: async () => {} })
      assert.equal(result.errorCode, 'VERCLY_POST_OUTCOME_UNKNOWN'); assert.equal(result.providerOrderAccepted, false)
      mode = 'NORMAL'
      const url = 'https://synthetic.vercly.invalid/api/verifications', init = { method: 'POST', body: JSON.stringify([{ Id: NIP, Country: 'PL' }]) }
      await assert.rejects(a.fetcher(url, init), unavailable); await assert.rejects(transport('VERCLY', { operationKey }).fetcher(url, init), unavailable); assert.equal(hits, n + 1)
    })
    await t.test('native revocation denies the current attempt and permits no raw response publication', async () => {
      const n = hits; onRequest = () => controlled(() => owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id='srm.provider.mgbi'"))
      await assert.rejects(transport('MGBI').fetcher(mgbiUrl()), unavailable); assert.equal(hits, n + 1)
      await controlled(() => owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE' WHERE source_id='srm.provider.mgbi'"))
      await controlled(() => owner.query("UPDATE profitia_external_native.policies SET status='REVOKED' WHERE policy_id IN(SELECT policy_id FROM profitia_external_call.policies WHERE source_id='srm.provider.mgbi')"))
      await assert.rejects(transport('MGBI').fetcher(mgbiUrl()), unavailable); assert.equal(hits, n + 1)
      await controlled(() => owner.query("UPDATE profitia_external_native.policies SET status='ACTIVE' WHERE policy_id IN(SELECT policy_id FROM profitia_external_call.policies WHERE source_id='srm.provider.mgbi')"))
    })
    await t.test('exhausted source budget and wrong physical role fail closed without upstream work', async () => {
      const n = hits
      await controlled(() => owner.query("UPDATE profitia_ingestion.budgets SET consumed_count=capacity WHERE source_id='srm.provider.ceidg'"))
      await assert.rejects(transport('CEIDG').fetcher('https://dane.biznes.gov.pl/api/ceidg/v3/firma?nip=' + NIP), unavailable)
      await assert.rejects(transport('MGBI', { binding: { ...settings('MGBI').binding, role: 'different_runtime' } }).fetcher(mgbiUrl()), unavailable)
      assert.equal(hits, n)
    })
    await t.test('redirect, canceled request and changed source configuration never bypass native policy', async () => {
      const n = hits; mode = 'REDIRECT'
      await assert.rejects(transport('MGBI').fetcher(mgbiUrl()), unavailable); mode = 'NORMAL'; assert.equal(hits, n + 1)
      const signal = AbortSignal.abort(); await assert.rejects(transport('MGBI').fetcher(mgbiUrl(), { signal }), unavailable); assert.equal(hits, n + 1)
      await assert.rejects(transport('MGBI', { external: { ...settings('MGBI').external, nativeSchemaDigest: '0'.repeat(64) } }).fetcher(mgbiUrl()), unavailable); assert.equal(hits, n + 1)
      assert.throws(() => transport('MGBI', { application: { ...application, environment: 'staging' } }))
      assert.throws(() => transport('MGBI', { auditPool: pool }))
    })
    await t.test('original MSR downloader retains a full20MiB admitted direct original without a JSON projection',async()=>{
      mode='MSR_DIRECT_MAX';const n=hits,before=await counts()
      try {
        const original=await downloadMsrOriginal(MSR_RECORD,{apiKey:CREDENTIAL,fetcher:msrTransport().fetcher})
        assert.equal(original.bytes.length,20*1024*1024);assert.equal(original.checksum,hash(original.bytes));assert.equal(original.recordId,MSR_RECORD)
        assert.equal(hits,n+2);assert(observed.slice(n).every(row=>row.authorization===CREDENTIAL))
        const after=await counts();assert.equal(after.admissions-before.admissions,2);assert.equal(after.sourceTransactions-before.sourceTransactions,6)
      } finally {mode='NORMAL'}
    })
    await t.test('only an actually admitted redirect permits credential-free storage and preserves original MSR bytes',async()=>{
      mode='MSR_REDIRECT_MAX';const n=hits
      try {
        const selected=msrTransport(),before=await counts()
        await assert.rejects(selected.fetcher(STORAGE_URL),unavailable);assert.equal(hits,n);assert.deepEqual(await counts(),before)
        const original=await downloadMsrOriginal(MSR_RECORD,{apiKey:CREDENTIAL,fetcher:selected.fetcher})
        assert.equal(original.bytes.length,20*1024*1024);assert.equal(original.checksum,hash(original.bytes));assert.equal(hits,n+3)
        assert.equal(observed[n].authorization,CREDENTIAL);assert.equal(observed[n+1].authorization,CREDENTIAL);assert.equal(observed[n+2].authorization,undefined)
        await assert.rejects(selected.fetcher(STORAGE_URL),unavailable);assert.equal(hits,n+3)
      } finally {mode='NORMAL'}
    })
    await t.test('MSR file choice, limits order and exact storage URL are enforced before an attempt',async()=>{
      mode='MSR_REDIRECT';const n=hits
      try {
        await assert.rejects(msrTransport().fetcher(MSR_FILE),unavailable);assert.equal(hits,n)
        const a=msrTransport()
        await a.fetcher('https://api.mgbi.pl/v1/models/pl-krs-rdf-record/limits',{redirect:'error'})
        await assert.rejects(a.fetcher(MSR_FILE.replace(MSR_RECORD,'e'.repeat(24))),unavailable);assert.equal(hits,n+1)
        const b=msrTransport();await b.fetcher('https://api.mgbi.pl/v1/models/pl-krs-rdf-record/limits',{redirect:'error'});await b.fetcher(MSR_FILE,{redirect:'manual'})
        const before=hits
        for(const url of[STORAGE_URL+'&extra=1',STORAGE_URL.replace('one.xhtml','other.xhtml'),STORAGE_URL.replace('https:','http:')])await assert.rejects(b.fetcher(url),unavailable)
        await assert.rejects(b.fetcher(STORAGE_URL,{headers:{Authorization:CREDENTIAL}}),unavailable);assert.equal(hits,before)
      } finally {mode='NORMAL'}
    })
    await t.test('original MSR budget denial and approved redirect bound cannot become another paid attempt',async()=>{
      let n=hits;mode='MSR_BUDGET'
      try {
        await assert.rejects(downloadMsrOriginal(MSR_RECORD,{apiKey:CREDENTIAL,fetcher:msrTransport().fetcher}),error=>error.code==='MSR_FILE_BUDGET_EXHAUSTED');assert.equal(hits,n+1)
        mode='MSR_CHAIN';n=hits;assert((await downloadMsrOriginal(MSR_RECORD,{apiKey:CREDENTIAL,fetcher:msrTransport().fetcher})).bytes.length>0);assert.equal(hits,n+4)
        mode='MSR_CHAIN_EXCESS';n=hits
        await assert.rejects(downloadMsrOriginal(MSR_RECORD,{apiKey:CREDENTIAL,fetcher:msrTransport().fetcher}),error=>error.code==='MSR_REDIRECT_LIMIT');assert.equal(hits,n+5)
      } finally {mode='NORMAL'}
    })
    await t.test('unapproved redirect, oversize body and uncertain MSR acquisition are never retried',async()=>{
      try {
        for(const selectedMode of['MSR_FOREIGN','MSR_OVERSIZE','MSR_DROP']) {
          mode=selectedMode;const operationKey=key(),selected=msrTransport({operationKey}),n=hits
          await assert.rejects(downloadMsrOriginal(MSR_RECORD,{apiKey:CREDENTIAL,fetcher:selected.fetcher}))
          assert.equal(hits,n+2)
          mode='MSR_DIRECT'
          await assert.rejects(selected.fetcher(MSR_FILE),unavailable)
          await assert.rejects(downloadMsrOriginal(MSR_RECORD,{apiKey:CREDENTIAL,fetcher:msrTransport({operationKey}).fetcher}));assert.equal(hits,n+2)
        }
      } finally {mode='NORMAL'}
    })
    await t.test('current MSR Source revocation or expiry prevents the selected file attempt',async()=>{
      mode='MSR_DIRECT';const selected=msrTransport(),n=hits
      try {
        await selected.fetcher('https://api.mgbi.pl/v1/models/pl-krs-rdf-record/limits',{redirect:'error'})
        await controlled(()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id='srm.provider.mgbi'"))
        await assert.rejects(selected.fetcher(MSR_FILE),unavailable);assert.equal(hits,n+1)
        await controlled(()=>owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE',expires_at=now()-interval '1 second' WHERE source_id='srm.provider.mgbi'"))
        await assert.rejects(msrTransport().fetcher('https://api.mgbi.pl/v1/models/pl-krs-rdf-record/limits'),unavailable);assert.equal(hits,n+1)
      } finally {await controlled(()=>owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE',expires_at=now()+interval '1 hour' WHERE source_id='srm.provider.mgbi'"));mode='NORMAL'}
    })
    await t.test('MSR storage configuration cannot be borrowed and a limits redirect is not file authority',async()=>{
      const n=hits
      assert.throws(()=>createSrmProviderSourceTransport({...settings('MGBI'),provider:'MGBI_MSR_STORAGE',providerOrigin:SRM_MSR_STORAGE_ORIGIN,headers:{},allowedStorageUrl:()=>STORAGE_URL}))
      mode='MSR_LIMITS_REDIRECT'
      try {
        const selected=msrTransport()
        await assert.rejects(downloadMsrOriginal(MSR_RECORD,{apiKey:CREDENTIAL,fetcher:selected.fetcher}))
        await assert.rejects(selected.fetcher(STORAGE_URL),unavailable);assert.equal(hits,n+1)
      } finally {mode='NORMAL'}
    })
    await t.test('MSR source revocation during the actual selected response refuses its bytes and another attempt',async()=>{
      mode='MSR_DIRECT';const selected=msrTransport(),n=hits
      try {
        await selected.fetcher('https://api.mgbi.pl/v1/models/pl-krs-rdf-record/limits',{redirect:'error'})
        onRequest=()=>controlled(()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id='srm.provider.mgbi'"))
        await assert.rejects(selected.fetcher(MSR_FILE),unavailable);assert.equal(hits,n+2)
        await assert.rejects(selected.fetcher(MSR_FILE),unavailable);assert.equal(hits,n+2)
      } finally {await controlled(()=>owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE' WHERE source_id='srm.provider.mgbi'"));onRequest=null;mode='NORMAL'}
    })
    await t.test('source records contain neither raw provider bodies, credentials, private keys nor invented human owners', async () => {
      const dump = JSON.stringify((await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows)
        + JSON.stringify((await owner.query('SELECT * FROM profitia_external_call.calls')).rows)
      assert(!dump.includes(CREDENTIAL)); for (const value of operationKeys) assert(!dump.includes(value))
      assert(!dump.includes('Synthetic Company')); assert(!dump.includes(NIP))
      assert(!dump.includes('fixture-signature'));assert(!dump.includes(MSR_RECORD))
      assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_ingestion.security_events WHERE event->>'organisationId' IS NOT NULL OR event->>'subjectUserId' IS NOT NULL")).rows[0].n, 0)
      await assert.rejects(pool.query('SELECT * FROM profitia_ingestion.security_events'), error => error.code === '42501')
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_access') AS namespace")).rows[0].namespace, null)
    })
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    await pool?.end(); await auditPool?.end(); await owner?.end()
    await root.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`); await root.end()
  }
})
