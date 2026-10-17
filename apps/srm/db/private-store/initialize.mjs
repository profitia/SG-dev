import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { inspectLedger, migrationManifest, migrationStatements } from '../../scripts/staging-migrate.mjs'

const sha256 = value => createHash('sha256').update(value).digest('hex')
const identifier = value => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value ?? '')) throw Error('Unsafe SQL identifier')
  return `"${value}"`
}
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const manifestUrl = new URL('./manifest.json', import.meta.url)
const boundaryUrl = new URL('../security/private-operation-boundaries.sql', import.meta.url)
const OWNER = 'profitia_access_owner'
const PRIVATE = ['organizations', 'suppliers', 'lookup_requests', 'provider_attempts',
  'source_snapshots', 'section_projections', 'financial_facts', 'mgbi_source_archives',
  'financial_source_documents', 'financial_scanner_frames', 'msr_sources', 'msr_projections']
const SHARED = ['catalog_companies', 'catalog_financial_facts', 'catalog_financial_indicators']
const CLOSED = ['users', 'organization_supplier_interest', 'user_supplier_interest',
  'catalog_kys_reports', 'supplier_web_identity']
const TABLES = [...PRIVATE, ...SHARED, ...CLOSED, 'schema_migrations', 'private_installation']

// A PostgreSQL native string transport, not a SQL splitter or another migrator.
// File bytes remain unchanged inside EXECUTE; each canonical ledger step keeps
// its original parameterized statement and is supplied through USING.
function nativeStatement(sql, values) {
  const delimiter = '$profitia_verified_source$'
  if (sql.includes(delimiter) || sql.includes('$profitia_apply$')) throw Error('SQL transport delimiter collision')
  const using = values ? ` USING ${values.map(literal).join(',')}` : ''
  return `DO $profitia_apply$ BEGIN EXECUTE ${delimiter}${sql}${delimiter}${using}; END $profitia_apply$`
}

export function assertPrivateBaseline(sources, boundary) {
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'))
  if (manifest.schemaVersion !== '1.0.0' || manifest.migrationBaselineCount !== 18
    || sources.length < 18 || manifest.migrations.length !== 18) throw Error('Private baseline missing')
  const baseline = sources.slice(0, 18)
  for (let i = 0; i < 18; i++) {
    if (baseline[i].version !== manifest.migrations[i].version
      || baseline[i].checksum !== manifest.migrations[i].checksum) throw Error('Private baseline checksum drift')
  }
  // Validate actual SQL bytes too, not merely supplied checksum metadata.
  migrationStatements(baseline)
  if (sha256(boundary) !== manifest.boundaryDigest) throw Error('Private boundary checksum drift')
  return { manifest, baseline }
}

/** Pure plan for a checked operator's ONE outer transaction. No connections,
 * role creation, app activation, data copying, CLI or automatic replay. The
 * caller verifies live provider/governance authority before executing it. */
export function privateBusinessPlan({ binding, sourceSha }) {
  if (!binding || !['development', 'staging'].includes(binding.environment)
    || !/^[a-f0-9]{40}$/.test(sourceSha ?? '')
    || !/^[a-z0-9-]{1,100}$/.test(binding.projectId ?? '')
    || !/^[a-z0-9-]{1,100}$/.test(binding.branchId ?? '')) throw Error('Explicit private physical binding and source SHA required')
  const db = identifier(binding.databaseName), runtime = identifier(binding.role)
  if ([OWNER, 'srm_app_runtime', 'neondb_owner', 'neon_superuser'].includes(binding.role)) throw Error('Ordinary distinct private runtime required')
  const boundary = readFileSync(boundaryUrl, 'utf8')
  const { manifest, baseline } = assertPrivateBaseline(migrationManifest(), boundary)
  const schemaDigest = sha256(JSON.stringify(manifest) + readFileSync(new URL(import.meta.url), 'utf8'))
  const sql = [
    "SET LOCAL statement_timeout='15s'",
    "SET LOCAL lock_timeout='3s'",
    "SET LOCAL idle_in_transaction_session_timeout='15s'",
    "SET LOCAL standard_conforming_strings=on",
    `SELECT pg_advisory_xact_lock(hashtext('srm-private-initial-schema'))`,
    `DO $guard$ BEGIN
      IF current_user <> session_user OR current_user IN (${literal(OWNER)},${literal(binding.role)})
        OR current_database() <> ${literal(binding.databaseName)} THEN
        RAISE EXCEPTION 'Checked operator and exact private database required'; END IF;
      IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='srm') THEN
        RAISE EXCEPTION 'SRM namespace already exists; reconcile receipt instead of replay'; END IF;
      IF NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton
        AND schema_version='1.0.0' AND schema_digest=${literal(manifest.controlSchemas.access)}
        AND project_id=${literal(binding.projectId)} AND branch_id=${literal(binding.branchId)}
        AND database_name=current_database() AND environment=${literal(binding.environment)})
        OR NOT EXISTS(SELECT 1 FROM profitia_modules.installation WHERE singleton
          AND schema_version='1.0.0' AND schema_digest=${literal(manifest.controlSchemas.module)})
        OR NOT EXISTS(SELECT 1 FROM profitia_modules.audit_installation WHERE singleton
          AND envelope_version='1.0.0' AND schema_digest=${literal(manifest.controlSchemas.audit)}) THEN
        RAISE EXCEPTION 'Accepted physical control, module and audit installations required'; END IF;
      IF EXISTS(SELECT 1 FROM profitia_access.applications WHERE status<>'DISABLED')
        OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='srm' AND status='DISABLED')
        OR NOT EXISTS(SELECT 1 FROM profitia_access.runtime_bindings WHERE login_role=${literal(binding.role)}
          AND application_id='srm' AND status='ACTIVE') THEN
        RAISE EXCEPTION 'Disabled applications and explicit SRM runtime binding required'; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${literal(OWNER)}
        AND NOT(rolcanlogin OR rolsuper OR rolinherit OR rolcreatedb OR rolcreaterole OR rolbypassrls))
        OR has_database_privilege(${literal(OWNER)},current_database(),'CREATE') THEN
        RAISE EXCEPTION 'Controlled owner must have no standing CREATE or elevated flags'; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${literal(binding.role)} AND rolcanlogin
        AND rolconnlimit=4 AND NOT(rolsuper OR rolinherit OR rolcreatedb OR rolcreaterole OR rolbypassrls))
        OR NOT has_database_privilege(${literal(binding.role)},current_database(),'CONNECT')
        OR has_database_privilege(${literal(binding.role)},current_database(),'CREATE,TEMP')
        OR pg_has_role(${literal(binding.role)},${literal(OWNER)},'MEMBER')
        OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='neon_superuser'
          AND pg_has_role(${literal(binding.role)},oid,'MEMBER')) THEN
        RAISE EXCEPTION 'Bound ordinary runtime privileges required'; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='srm_app_runtime'
        AND NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls))
        OR has_database_privilege('srm_app_runtime',current_database(),'CONNECT')
        OR pg_has_role('srm_app_runtime',${literal(OWNER)},'MEMBER')
        OR pg_has_role(${literal(binding.role)},'srm_app_runtime','MEMBER')
        OR EXISTS(SELECT 1 FROM profitia_access.runtime_bindings WHERE login_role='srm_app_runtime') THEN
        RAISE EXCEPTION 'Unbound legacy policy role without private CONNECT required'; END IF;
      IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
        WHERE d.defaclrole=${literal(OWNER)}::regrole AND d.defaclnamespace=0
          AND d.defaclobjtype IN ('r','S','f') AND a.grantee<>${literal(OWNER)}::regrole::oid) THEN
        RAISE EXCEPTION 'Unexpected global default ACL'; END IF;
    END $guard$`,
    `GRANT CREATE ON DATABASE ${db} TO ${identifier(OWNER)}`,
    `SET LOCAL ROLE ${identifier(OWNER)}`,
  ]
  for (const step of migrationStatements(inspectLedger([], baseline))) sql.push(nativeStatement(step.sql, step.values))
  sql.push(nativeStatement(boundary))
  sql.push(`DO $close$ DECLARE name text; BEGIN
    FOREACH name IN ARRAY ARRAY[${CLOSED.map(literal).join(',')}] LOOP
      EXECUTE format('CREATE POLICY private_unadopted_fence ON srm.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false)',name);
    END LOOP;
    FOREACH name IN ARRAY ARRAY[${TABLES.filter(t => t !== 'private_installation').map(literal).join(',')}] LOOP
      EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY',name);
      EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY',name);
    END LOOP;
  END $close$`)
  sql.push(`CREATE POLICY controlled_ledger_owner ON srm.schema_migrations
    USING(current_user=${literal(OWNER)}) WITH CHECK(current_user=${literal(OWNER)})`)
  sql.push(`CREATE TABLE srm.private_installation (
    singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
    schema_version text NOT NULL CHECK(schema_version='1.0.0'),
    schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
    boundary_digest text NOT NULL CHECK(boundary_digest ~ '^[a-f0-9]{64}$'),
    source_ref text NOT NULL CHECK(source_ref ~ '^[a-f0-9]{40}$'),
    installed_by text NOT NULL DEFAULT session_user,
    installed_at timestamptz NOT NULL DEFAULT clock_timestamp())`)
  sql.push('ALTER TABLE srm.private_installation ENABLE ROW LEVEL SECURITY')
  sql.push('ALTER TABLE srm.private_installation FORCE ROW LEVEL SECURITY')
  sql.push(`CREATE POLICY controlled_installation_owner ON srm.private_installation
    USING(current_user=${literal(OWNER)}) WITH CHECK(current_user=${literal(OWNER)})`)
  for (const kind of ['SCHEMA srm', 'ALL TABLES IN SCHEMA srm', 'ALL SEQUENCES IN SCHEMA srm', 'ALL FUNCTIONS IN SCHEMA srm']) {
    sql.push(`REVOKE ALL ON ${kind} FROM PUBLIC,srm_app_runtime`)
  }
  sql.push(`GRANT USAGE ON SCHEMA srm TO ${runtime}`)
  sql.push(`GRANT SELECT ON ${[...PRIVATE, ...SHARED, 'catalog_kys_reports'].map(t => `srm.${t}`).join(',')} TO ${runtime}`)
  sql.push(`GRANT INSERT,UPDATE ON srm.financial_source_documents,srm.suppliers TO ${runtime}`)
  sql.push(`GRANT INSERT ON srm.financial_scanner_frames TO ${runtime}`)
  sql.push(`GRANT UPDATE(last_checked_at) ON srm.mgbi_source_archives TO ${runtime}`)
  sql.push(`INSERT INTO srm.private_installation(schema_version,schema_digest,boundary_digest,source_ref)
    VALUES('1.0.0',${literal(schemaDigest)},${literal(manifest.boundaryDigest)},${literal(sourceSha)})`)
  sql.push('RESET ROLE')
  sql.push(`REVOKE CREATE ON DATABASE ${db} FROM ${identifier(OWNER)}`)
  sql.push(`DO $verify$ BEGIN
    IF has_database_privilege(${literal(OWNER)},current_database(),'CREATE')
      OR has_schema_privilege('srm_app_runtime','srm','USAGE')
      OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='srm' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
          AND c.relowner=${literal(OWNER)}::regrole) <> ${TABLES.length}
      OR (SELECT count(*) FROM srm.schema_migrations) <> 18 THEN
      RAISE EXCEPTION 'Private initialization postcondition failed'; END IF;
  END $verify$`)
  return { schemaVersion: '1.0.0', schemaDigest, boundaryDigest: manifest.boundaryDigest,
    migrationCount: 18, expectedTables: [...TABLES], sql }
}
