// Test support only. Never imported by a deployed product entry point.
import pg from 'pg'
import { createTestIdentityIssuer } from './operation-test-authority.mjs'

export const TEST_ORGANISATIONS = Object.freeze({ a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222' })
export const TEST_USERS = Object.freeze({ a: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', c: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })

export function assertIsolatedTestConnection(value, database, role) {
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['sg2_operation_test', 'srm_app'].includes(database) || decodeURIComponent(url.pathname.slice(1)) !== database || decodeURIComponent(url.username) !== role || !/^(architecture_test_owner|sg2_operation_runtime|sg2_operation_reader|srm_app_runtime)$/.test(role)) throw Error('Only the explicit disposable loopback operation-test database and role are allowed')
  return value
}

export async function initialiseAuthoritySchema(owner, roles) {
  if (!roles.length || roles.some(r => !['sg2_operation_runtime', 'sg2_operation_reader', 'srm_app_runtime'].includes(r))) throw Error('Explicit test roles required')
  await owner.query(`CREATE SCHEMA IF NOT EXISTS operation_test;
    CREATE TABLE operation_test.authorities(application_id text NOT NULL, environment text NOT NULL, organisation_id text NOT NULL, actor_id text NOT NULL, document jsonb NOT NULL, lock_token integer NOT NULL DEFAULT 0, PRIMARY KEY(application_id,environment,organisation_id,actor_id));
    CREATE TABLE operation_test.resources(application_id text NOT NULL, environment text NOT NULL, organisation_id text NOT NULL, id text NOT NULL, document jsonb NOT NULL, lock_token integer NOT NULL DEFAULT 0, PRIMARY KEY(application_id,environment,organisation_id,id));
    CREATE TABLE operation_test.audit(id bigserial PRIMARY KEY, application_id text NOT NULL, event jsonb NOT NULL);
    CREATE TABLE operation_test.personal_records(organisation_id text NOT NULL,user_id text NOT NULL,id text NOT NULL,body jsonb NOT NULL,PRIMARY KEY(organisation_id,user_id,id));
    ALTER TABLE operation_test.authorities ENABLE ROW LEVEL SECURITY; ALTER TABLE operation_test.authorities FORCE ROW LEVEL SECURITY;
    ALTER TABLE operation_test.resources ENABLE ROW LEVEL SECURITY; ALTER TABLE operation_test.resources FORCE ROW LEVEL SECURITY;
    ALTER TABLE operation_test.audit ENABLE ROW LEVEL SECURITY; ALTER TABLE operation_test.audit FORCE ROW LEVEL SECURITY;
    ALTER TABLE operation_test.personal_records ENABLE ROW LEVEL SECURITY; ALTER TABLE operation_test.personal_records FORCE ROW LEVEL SECURITY;
    CREATE POLICY authority_read ON operation_test.authorities FOR SELECT USING(application_id=current_setting('operation.app_id',true) AND environment=current_setting('operation.environment',true) AND organisation_id=current_setting('operation.organisation_id',true) AND actor_id=current_setting('operation.user_id',true));
    CREATE POLICY resource_read ON operation_test.resources FOR SELECT USING(application_id=current_setting('operation.app_id',true) AND environment=current_setting('operation.environment',true) AND organisation_id=current_setting('operation.organisation_id',true));
    CREATE POLICY authority_lock ON operation_test.authorities FOR UPDATE USING(application_id=current_setting('operation.app_id',true) AND environment=current_setting('operation.environment',true) AND organisation_id=current_setting('operation.organisation_id',true) AND actor_id=current_setting('operation.user_id',true)) WITH CHECK(false);
    CREATE POLICY resource_lock ON operation_test.resources FOR UPDATE USING(application_id=current_setting('operation.app_id',true) AND environment=current_setting('operation.environment',true) AND organisation_id=current_setting('operation.organisation_id',true)) WITH CHECK(false);
    CREATE POLICY audit_append ON operation_test.audit FOR INSERT WITH CHECK(application_id=current_setting('operation.app_id',true));
    CREATE POLICY personal_scope ON operation_test.personal_records USING(organisation_id=current_setting('operation.organisation_id',true) AND user_id=current_setting('operation.user_id',true)) WITH CHECK(organisation_id=current_setting('operation.organisation_id',true) AND user_id=current_setting('operation.user_id',true));`)
  // PostgreSQL row locks require UPDATE on at least one column. Only a dummy
  // lock column is granted; no UPDATE policy or grant on authority JSON exists.
  for (const role of roles) await owner.query(`GRANT USAGE ON SCHEMA operation_test TO ${role}; GRANT SELECT ON operation_test.authorities,operation_test.resources TO ${role}; GRANT UPDATE(lock_token) ON operation_test.authorities,operation_test.resources TO ${role}; GRANT INSERT ON operation_test.audit TO ${role}; GRANT USAGE ON SEQUENCE operation_test.audit_id_seq TO ${role}; GRANT SELECT,INSERT,UPDATE ON operation_test.personal_records TO ${role};`)
}

export async function seedAuthority(owner, application, permissions) {
  const expiry = new Date(Date.now() + 86_400_000).toISOString()
  for (const [organisationId, userId] of [[TEST_ORGANISATIONS.a, TEST_USERS.a], [TEST_ORGANISATIONS.a, TEST_USERS.b], [TEST_ORGANISATIONS.b, TEST_USERS.a], [TEST_ORGANISATIONS.b, TEST_USERS.c]]) {
    const document = { policyVersion: 'isolated-policy-v1', usagePolicy: 'NOT_APPLICABLE',
      access: { type: 'MEMBERSHIP', actorId: userId, organisationId, status: 'ACTIVE', version: 'membership-v1', sourceRef: `synthetic-membership:${organisationId}:${userId}`, expiresAt: expiry, permissions, denies: [] },
      products: ['SPENDGURU', 'SUPPLIER_INTELLIGENCE'].map(product => ({ product, features: ['benchmark', 'supplier_report', 'market', 'personal_workspace'], organisationId, environment: application.environment, applicationId: application.appId, status: 'ACTIVE', version: 'synthetic-offer-v1', source: 'CONTRACT', sourceRef: 'SYNTHETIC_NOT_A_COMMERCIAL_GRANT', expiresAt: expiry })),
    }
    await owner.query('INSERT INTO operation_test.authorities VALUES($1,$2,$3,$4,$5::jsonb)', [application.appId, application.environment, organisationId, userId, JSON.stringify(document)])
  }
}

export async function putTestResource(owner, application, organisationId, resource) {
  await owner.query('INSERT INTO operation_test.resources VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(application_id,environment,organisation_id,id) DO UPDATE SET document=EXCLUDED.document', [application.appId, application.environment, organisationId, resource.id, JSON.stringify(resource)])
}

export function createPostgresAuthority({ ownerUrl, runtimeUrl, database, role, application, projectOutput, transactionDriver }) {
  if (!['sg2_operation_runtime', 'sg2_operation_reader', 'srm_app_runtime'].includes(role)) throw Error('An ordinary test runtime role is required')
  assertIsolatedTestConnection(ownerUrl, database, 'architecture_test_owner')
  assertIsolatedTestConnection(runtimeUrl, database, role)
  const pool = new pg.Pool({ connectionString: runtimeUrl, max: 1 })
  const auditPool = new pg.Pool({ connectionString: runtimeUrl, max: 1 })
  const issuer = createTestIdentityIssuer({ applicationId: application.appId, environment: application.environment })
  const boundApplication = { ...application, identityIssuer: issuer.issuer }
  const append = (query, event) => query('INSERT INTO operation_test.audit(application_id,event) VALUES($1,$2::jsonb)', [application.appId, JSON.stringify(event)])
  const setContext = async (query, actorId, organisationId) => {
    await query("SELECT set_config('operation.app_id',$1,true),set_config('operation.environment',$2,true),set_config('operation.organisation_id',$3,true),set_config('operation.user_id',$4,true)", [application.appId, application.environment, organisationId ?? '', actorId ?? ''])
  }
  const ownTransaction = async action => {
    const client = await pool.connect()
    try { await client.query('BEGIN'); const value = await action({ query: client.query.bind(client), transaction: client }); await client.query('COMMIT'); return value }
    catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
  const recordAudit = async event => {
    const client = await auditPool.connect()
    try { await client.query('BEGIN'); await setContext(client.query.bind(client), event.actorId, event.organisationId); await append(client.query.bind(client), event); await client.query('COMMIT') }
    catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
  const withTransaction = ({ actor, request }, callback) => (transactionDriver ?? ownTransaction)(async ({ query, transaction }) => {
    const { rows: [identity] } = await query("SELECT current_database() AS database_name,current_user AS role,r.rolsuper,r.rolbypassrls,EXISTS(SELECT 1 FROM pg_roles n WHERE n.rolname='neon_superuser' AND pg_has_role(current_user,n.oid,'member')) AS neon_member FROM pg_roles r WHERE r.rolname=current_user", [])
    if (identity?.database_name !== database || identity.role !== role || identity.rolsuper || identity.rolbypassrls || identity.neon_member) throw Error('Actual ordinary-role connection identity mismatch')
    await setContext(query, actor.actorId, request.organisationId)
    const { rows: [authority] } = await query('SELECT document FROM operation_test.authorities WHERE application_id=$1 AND environment=$2 AND organisation_id=$3 AND actor_id=$4 FOR SHARE', [application.appId, application.environment, request.organisationId ?? '', actor.actorId])
    const resourceLock = ['account.settings.write', 'benchmark.selection.write', 'personal.list.write', 'supplier.report.project'].includes(request.operation) ? 'FOR UPDATE' : 'FOR SHARE'
    const { rows: [resource] } = await query('SELECT document FROM operation_test.resources WHERE application_id=$1 AND environment=$2 AND organisation_id=$3 AND id=$4 ' + resourceLock, [application.appId, application.environment, request.organisationId ?? '', request.resourceId])
    const state = { ...(authority?.document ?? { policyVersion: 'isolated-policy-v1', usagePolicy: 'NOT_APPLICABLE' }), resource: resource?.document, inputs: resource?.document?.inputs, applicationId: application.appId, environment: application.environment }
    return callback({ state, transaction, transactionalEffects: true, outputBoundaryVersion: 'operation-v1', recordOutcome: event => append(query, event), projectOutput })
  })
  return {
    options: { application: boundApplication, authenticate: issuer.authenticate, withTransaction, recordAudit }, issuer, pool,
    async close() { await Promise.all([pool.end(), auditPool.end()]) },
  }
}
