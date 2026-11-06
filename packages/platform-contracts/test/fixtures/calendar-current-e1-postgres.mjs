// SYNTHETIC_ONLY. Canonical central E1 fixture plus an independent local receiver.
// No fixture is imported by a runtime or connected to a provider / Neon project.
import fs from 'node:fs'
import {createHash, randomBytes, randomUUID} from 'node:crypto'
import pg from '../../../../apps/architecture-lab/node_modules/pg/lib/index.js'
import {currentE1Fixture, U, V, A, B} from './current-e1-authority-postgres.mjs'
export {U, V, A, B}
const load = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
export async function calendarE1Fixture({base = null, closeBase = true} = {}) {
  const f = base ?? await currentE1Fixture()
  const name = 'calendar_fixture_' + randomUUID().replaceAll('-', ''), pools = []
  let admin, created = false
  const runtimeRole = 'economic_calendar_development_runtime', ownerRole = 'economic_calendar_development_owner', ingestRole = 'economic_calendar_development_ingest', migratorRole = 'economic_calendar_development_migrator'
  const password = 'SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL', applicationId = 'profitia-economic-calendar-runtime-development', origin = 'https://calendar.synthetic.test'
  const close = async () => {for (const pool of pools) await pool.end(); if (admin) await admin.end(); if (created) await f.databases[0].query('DROP DATABASE IF EXISTS ' + name + ' WITH (FORCE)'); if (!base || closeBase) await f.close()}
  try {
    const root = f.databases[0]
    await root.query("SELECT pg_advisory_lock(hashtextextended('calendar-fixture-roles',0))")
    try {
      for (const role of [runtimeRole, ingestRole, migratorRole, ownerRole]) {
        if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await root.query('CREATE ROLE ' + role + (role === ownerRole ? ' NOLOGIN' : " LOGIN PASSWORD '" + password + "'") + ' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION')
      }
      await root.query('GRANT profitia_access_owner,' + ownerRole + ' TO ' + migratorRole)
    } finally {await root.query("SELECT pg_advisory_unlock(hashtextextended('calendar-fixture-roles',0))")}
    await root.query('CREATE DATABASE ' + name); created = true
    admin = new pg.Client({...root.connectionParameters, database: name}); await admin.connect()
    await admin.query('CREATE EXTENSION pgcrypto')
    await admin.query('GRANT CREATE ON DATABASE ' + name + ' TO profitia_access_owner,' + ownerRole)
    const asOwner = async (role, action) => {
      await admin.query('BEGIN')
      try {await admin.query('SET LOCAL ROLE ' + role); const value = await action(admin); await admin.query('COMMIT'); return value}
      catch (error) {await admin.query('ROLLBACK'); throw error}
    }
    const access = load('../../migrations/access/001-internal-access.sql'), schemaDigest = createHash('sha256').update(access).digest('hex')
    const configuration = {applicationId, environment: 'development', projectId: 'SYNTHETIC_ONLY_PROJECT', branchId: 'SYNTHETIC_ONLY_BRANCH', databaseName: name, runtimeRole,
      deploymentId: 'SYNTHETIC_ONLY', configurationVersion: 'SYNTHETIC_ONLY', identityIssuer: f.issuer, publicOrigin: origin, allowedOrigins: [origin]}
    const binding = {applicationId, environment: 'development', projectId: configuration.projectId, branchId: configuration.branchId, databaseName: name, role: runtimeRole, schemaDigest}
    await asOwner('profitia_access_owner', async q => {
      await q.query(access)
      await q.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development',$2,$3,$4)", [schemaDigest, configuration.projectId, configuration.branchId, name])
      await q.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')", [applicationId])
      await q.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')", [runtimeRole, applicationId])
      await q.query(load('../../current-e1-authority/migrations/002-receiver.sql'))
      await q.query(load('../../current-e1-authority/migrations/006-calendar-receiver.sql'))
      await q.query('GRANT USAGE ON SCHEMA profitia_access,profitia_e1_receiver TO ' + runtimeRole + ',' + ownerRole)
      await q.query('GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.append_audit(jsonb) TO ' + runtimeRole + ',' + ownerRole)
      await q.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_e1_receiver TO ' + runtimeRole + ',' + ownerRole)
    })
    const authenticate = f.client.authenticateRequest, getSession = f.client.sessions.getSession
    f.client.authenticateRequest = async (request, ...args) => {
      if (request.headers.get('authorization') !== 'Bearer SYNTHETIC_NEW_SESSION_A') return authenticate(request, ...args)
      const sid = 'session_second_' + U
      return {status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'user_'+U,sessionId:sid,sessionClaims:{iss:f.issuer,sub:'user_'+U,sid,azp:f.clerkState.azp,exp:Math.floor(Date.now()/1000)+3600}})}
    }
    f.client.sessions.getSession = async id => id === 'session_second_' + U ? {id,userId:'user_'+U,status:f.clerkState.sessionActive?'active':'revoked',actor:null,expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000} : getSession(id)
    const key = randomBytes(32), keyId = 'SYNTHETIC_ONLY_calendar'
    await f.asOwner(0, async q => {
      await q.query(load('../../current-e1-authority/migrations/005-calendar-authority.sql'))
      await q.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')", [applicationId])
      await q.query("UPDATE profitia_access.product_grants SET features=ARRAY['benchmark','market','personal_workspace'] WHERE application_id='spendguru'")
      for (const org of [A, B]) {
        await q.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,'SPENDGURU',ARRAY['market','personal_workspace'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',now()+interval '1 hour')", [applicationId, org])
        for (const user of [U, V]) for (const operation of ['knowledge.read', 'personal.list.read', 'personal.list.write']) await q.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id) VALUES($1,$2,$3,$4,'ALLOW',$5,$6,$7)", [randomUUID(), applicationId, org, user, operation, operation === 'knowledge.read' ? 'market' : 'personal_workspace', operation === 'knowledge.read' ? 'economic-calendar-events' : 'economic-calendar-preferences'])
      }
      await q.query("INSERT INTO profitia_e1_authority.receivers VALUES($1,$2::jsonb,$3,$4,'economic-calendar',$5,$6,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [applicationId, JSON.stringify(binding), f.issuer, [origin, f.origin, 'https://spendguru.synthetic.test'], keyId, key])
    })
    await asOwner('profitia_access_owner', q => q.query("INSERT INTO profitia_e1_receiver.installation VALUES(true,$1,$2::jsonb,$3,'economic-calendar',$4,$5,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [runtimeRole, JSON.stringify(binding), f.authorityOrigin, keyId, key]))
    const pool = role => {const p = new pg.Pool({...admin.connectionParameters, user: role, password, max: 5, query_timeout: 10000, connectionTimeoutMillis: 3000}); pools.push(p); return p}
    const runtimePool = pool(runtimeRole), ingestPool = pool(ingestRole), migratorPool = pool(migratorRole)
    const database = p => ({query: (s, v = []) => p.query(s, v), verifyLogin: async () => true, transact: async action => {const c = await p.connect(); try {await c.query('BEGIN'); const query = (s, v = []) => c.query(s, v); const value = await action({query, transaction: {query}}); await c.query('COMMIT'); return value} catch (error) {await c.query('ROLLBACK'); throw error} finally {c.release()}}})
    return {...f, close, calendar: {configuration, binding, admin, asOwner, runtime: database(runtimePool), ingest: database(ingestPool), migratorPool,
      request: (token = 'SYNTHETIC_A') => new Request(origin + '/v1/', {headers: {authorization: 'Bearer ' + token}})}}
  } catch (error) {await close(); throw error}
}
