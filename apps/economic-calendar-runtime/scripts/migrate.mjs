import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import pg from 'pg'
import {loadConfiguration} from '../src/config.mjs'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const accessUrl = new URL('../../../packages/platform-contracts/migrations/access/001-internal-access.sql', import.meta.url)
const receiverUrl = new URL('../../../packages/platform-contracts/current-e1-authority/migrations/', import.meta.url)
const schemaUrl = new URL('../migrations/001-read-model-and-preferences.sql', import.meta.url)
export async function migrate(client, configuration) {
  const {rows: [login]} = await client.query('SELECT current_user AS role,session_user AS login,current_database() AS database,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=current_user')
  if (configuration.environment !== 'development' || login.role !== 'economic_calendar_development_migrator' || login.login !== login.role || login.database !== configuration.databaseName || login.rolsuper || login.rolbypassrls || login.rolcreaterole || login.rolcreatedb || login.rolreplication) throw new Error('MIGRATOR_BINDING_REFUSED')
  const access = await readFile(accessUrl, 'utf8'), receiver = await readFile(new URL('002-receiver.sql', receiverUrl), 'utf8'), calendar = await readFile(new URL('006-calendar-receiver.sql', receiverUrl), 'utf8'), schema = await readFile(schemaUrl, 'utf8')
  await client.query('BEGIN')
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('economic-calendar-product-migrations',0))")
    const {rows: [extensions]} = await client.query("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto' AND extnamespace='public'::regnamespace) AS crypto")
    if (!extensions.crypto) throw new Error('OWNER_PROVISIONED_PGCRYPTO_REQUIRED')
    for (const forbidden of ['source_hub', 'newsfeed', 'profitia_e1_authority']) {
      if ((await client.query('SELECT to_regnamespace($1) IS NOT NULL AS present', [forbidden])).rows[0].present) throw new Error('DEDICATED_PRODUCT_STORAGE_REQUIRED')
    }
    if ((await client.query("SELECT to_regclass('public.conversation_artifacts') IS NOT NULL AS present")).rows[0].present) throw new Error('PMOS_IS_NOT_PRODUCT_STORAGE')
    await client.query('SET LOCAL ROLE profitia_access_owner')
    const existing = (await client.query("SELECT to_regnamespace('profitia_access') IS NOT NULL AS present")).rows[0].present
    if (!existing) {
      await client.query(access)
      await client.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development',$2,$3,$4)", [digest(access), configuration.projectId, configuration.branchId, configuration.databaseName])
    } else {
      const {rows: [i]} = await client.query('SELECT * FROM profitia_access.installation WHERE singleton')
      if (!i || i.schema_digest !== digest(access) || i.environment !== 'development' || i.project_id !== configuration.projectId || i.branch_id !== configuration.branchId || i.database_name !== configuration.databaseName) throw new Error('EXISTING_ACCESS_BINDING_MISMATCH')
    }
    // Only descriptor/audit support locally. Identity remains central; never
    // populate mirrored accounts, external subjects, memberships or offers.
    const {rows: [directory]} = await client.query('SELECT EXISTS(SELECT 1 FROM profitia_access.accounts) OR EXISTS(SELECT 1 FROM profitia_access.external_identities) OR EXISTS(SELECT 1 FROM profitia_access.memberships) OR EXISTS(SELECT 1 FROM profitia_access.product_grants) AS populated')
    if (directory.populated) throw new Error('LOCAL_IDENTITY_DIRECTORY_REFUSED')
    const receiverPresent = (await client.query("SELECT to_regnamespace('profitia_e1_receiver') IS NOT NULL AS present")).rows[0].present
    if (!receiverPresent) {await client.query(receiver); await client.query(calendar)}
    else if (!(await client.query("SELECT to_regprocedure('profitia_e1_receiver.calendar_scope(text,uuid,boolean)') IS NOT NULL AS present")).rows[0].present) await client.query(calendar)
    for (const role of ['economic_calendar_development_runtime', 'economic_calendar_development_owner']) {
      await client.query('GRANT USAGE ON SCHEMA profitia_access,profitia_e1_receiver TO ' + role)
      await client.query('GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.append_audit(jsonb) TO ' + role)
      for (const signature of ['descriptor()', 'challenge(text,uuid,text,text,text)', 'accept(jsonb)', 'append_audit(jsonb)', 'calendar_scope(text,uuid,boolean)']) await client.query('GRANT EXECUTE ON FUNCTION profitia_e1_receiver.' + signature + ' TO ' + role)
    }
    await client.query('SET LOCAL ROLE economic_calendar_development_owner')
    const present = (await client.query("SELECT to_regnamespace('economic_calendar') IS NOT NULL AS present")).rows[0].present
    if (!present) {
      await client.query(schema)
      await client.query("INSERT INTO economic_calendar.installation(singleton,schema_digest,receiver_base_digest,calendar_receiver_digest,application_id,environment,project_id,branch_id,database_name,status,source_ref) VALUES(true,$1,$2,$3,$4,'development',$5,$6,$7,'ACTIVE',$8)", [digest(schema), digest(receiver), digest(calendar), configuration.applicationId, configuration.projectId, configuration.branchId, configuration.databaseName, 'accepted-source:' + configuration.deploymentId])
    } else {
      const {rows: [i]} = await client.query('SELECT * FROM economic_calendar.installation WHERE singleton')
      if (!i || i.schema_digest !== digest(schema) || i.receiver_base_digest !== digest(receiver) || i.calendar_receiver_digest !== digest(calendar) || i.application_id !== configuration.applicationId || i.project_id !== configuration.projectId || i.branch_id !== configuration.branchId || i.database_name !== configuration.databaseName) throw new Error('EXISTING_PRODUCT_SCHEMA_MISMATCH')
    }
    await client.query('COMMIT')
    return {status: 'INSTALLED_OR_VERIFIED', schemaDigest: digest(schema), receiverBaseDigest: digest(receiver), calendarReceiverDigest: digest(calendar), enrollment: 'SEPARATE_OWNER_ACTION_REQUIRED'}
  } catch (error) {await client.query('ROLLBACK'); throw error}
}
async function main() {
  const configuration = loadConfiguration(process.env, 'migrator'), u = new URL(configuration.connectionString)
  u.searchParams.delete('sslmode'); u.searchParams.delete('channel_binding')
  const client = new pg.Client({connectionString: u.href, ssl: {rejectUnauthorized: true}, enableChannelBinding: true})
  await client.connect()
  try {process.stdout.write(JSON.stringify(await migrate(client, configuration)) + '\n')} finally {await client.end()}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {process.stderr.write('{"error":"ECR_MIGRATION_REFUSED_OR_FAILED"}\n'); process.exitCode = 1})
