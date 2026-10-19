import { assertProductConnection, productOrganizationId } from "./runtime-environment";
import { atLookupStage } from "./lookup-diagnostics";
import pg, { type PoolClient } from "pg";
import type { OperationContext } from "@profitia/platform-contracts/operation-context";

export type DatabasePool = Pick<pg.Pool, "connect">;
interface DelegatedPhaseScope {
  readonly kind: 'WRITE_PHASE' | 'INSPECTION';
  readonly actorId: string; readonly applicationId: string; readonly subjectUserId: string
  readonly requestId: string; readonly phaseId: string; readonly inputDigest: string
  readonly schemaDigest: string; readonly delegatedSchemaDigest: string; readonly transactionId: string
  readonly inspectionSchemaDigest?: string; readonly acceptedTransactionId?: string
}
const boundTransactions = new WeakMap<DatabasePool, { organizationId: string; client: PoolClient; delegated?: Readonly<DelegatedPhaseScope> }>();

/** Server-only capability for an already authorised, active transaction. */
export function bindOrganizationTransaction(organizationId: string, client: PoolClient, serviceContext?: Readonly<OperationContext>): DatabasePool {
  assertOrganizationId(organizationId);
  let delegated: Readonly<DelegatedPhaseScope> | undefined;
  if (serviceContext !== undefined) {
    const c = serviceContext, inspection = c?.requestInspection, phase = c?.requestContinuation ?? inspection;
    const schemaDigest = inspection?.continuationSchemaDigest ?? phase?.schemaDigest;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!c || c.actorKind !== 'SERVICE' || c.actor?.kind !== 'SERVICE' || c.actorId !== c.actor.actorId
      || c.actorId !== c.actor.serviceId || c.operation !== 'job.execute' || c.organisationId !== organizationId
      || !uuid.test(c.actorId) || !uuid.test(c.subjectUserId ?? '') || !phase || !uuid.test(phase.requestId)
      || c.resourceId !== phase.requestId || c.delegation?.requestId !== phase.requestId
      || c.delegation.subjectUserId !== c.subjectUserId || c.delegation.organisationId !== organizationId
      || c.delegation.target.operation !== 'supplier.report.refresh' || c.delegation.target.application.appId !== 'srm'
      || !['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'].includes(phase.phaseId)
      || (c.requestContinuation !== undefined && inspection !== undefined)
      || ![phase.inputDigest,schemaDigest,phase.delegatedSchemaDigest].every(v => /^[a-f0-9]{64}$/.test(v ?? ''))
      || inspection !== undefined && (!/^[a-f0-9]{64}$/.test(inspection.schemaDigest)
        || !/^[1-9][0-9]*$/.test(inspection.acceptedTransactionId) || inspection.acceptedTransactionId === inspection.transactionId)
      || !/^[1-9][0-9]*$/.test(phase.transactionId) || !c.applicationId) throw new Error('Explicit current delegated Supplier phase required');
    // Snapshot provenance only, never an identity token or authority. SQL below
    // revalidates the real executor and current effect on the actual client.
    delegated = Object.freeze({ kind: inspection ? 'INSPECTION' as const : 'WRITE_PHASE' as const,
      actorId: c.actorId, applicationId: c.applicationId, subjectUserId: c.subjectUserId!,
      requestId: phase.requestId, phaseId: phase.phaseId, inputDigest: phase.inputDigest,
      schemaDigest: schemaDigest!, delegatedSchemaDigest: phase.delegatedSchemaDigest!, transactionId: phase.transactionId,
      ...(inspection ? { inspectionSchemaDigest: inspection.schemaDigest, acceptedTransactionId: inspection.acceptedTransactionId } : {}) });
  }
  const pool: DatabasePool = { connect: async () => client };
  boundTransactions.set(pool, { organizationId, client, ...(delegated ? { delegated } : {}) });
  return pool;
}
let sharedPool: pg.Pool | undefined;

export function runtimeConnectionString(environment: Readonly<Record<string, string | undefined>> = process.env): string {
  if (environment.SRM_APP_DATABASE_URL) { assertProductConnection(environment.SRM_APP_DATABASE_URL, environment); return environment.SRM_APP_DATABASE_URL; }
  const host = environment.SRM_APP_DATABASE_HOST;
  const password = environment.SRM_APP_DATABASE_PASSWORD;
  if (!host || !password) throw new Error("SRM application database configuration is required");
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech$/i.test(host)) {
    throw new Error("SRM application database host is invalid");
  }
  const url = new URL(`postgresql://srm_app_runtime@${host}/srm_app`);
  url.password = password;
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("channel_binding", "require");
  assertProductConnection(url.toString(), environment);
  return url.toString();
}

export function getPool(): pg.Pool {
  const connectionString = runtimeConnectionString();
  sharedPool ??= new pg.Pool({ connectionString, max: 8 });
  return sharedPool;
}

export function assertOrganizationId(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("A valid organization UUID is required");
  }
}

export async function withOrganization<T>(
  organizationId: string,
  action: (client: PoolClient) => Promise<T>,
  pool: DatabasePool = getPool(),
): Promise<T> {
  assertOrganizationId(organizationId);
  const bound = boundTransactions.get(pool);
  if (bound && bound.organizationId !== organizationId) throw new Error("SRM bound transaction organization mismatch");
  if (!bound && process.env.TARGET_ENVIRONMENT && organizationId !== productOrganizationId()) {
    throw new Error("SRM configured organization identity mismatch");
  }
  const client = await pool.connect();
  let inTransaction = false;
  try {
    if (!bound) {
      await client.query("BEGIN");
      inTransaction = true;
    }
    const identity = await client.query<{
      database_name: string;
      bypass_rls: boolean;
      superuser: boolean;
      neon_superuser_member: boolean;
    }>(
      "SELECT current_database() AS database_name, r.rolbypassrls AS bypass_rls, " +
      "r.rolsuper AS superuser, pg_has_role(current_user, 'neon_superuser', 'member') AS neon_superuser_member " +
      "FROM pg_roles r WHERE r.rolname = current_user",
    );
    const role = identity.rows[0];
    if (bound?.delegated) {
      const d = bound.delegated;
      const inspecting = d.kind === 'INSPECTION';
      const proof = await client.query<{ allowed: boolean; descriptor: Record<string,string> | null; transaction_id: string; role: string; login: string }>(inspecting ?
        "SELECT profitia_request_inspection.scope_allows($1::uuid,$2,$3::uuid,$4::uuid) AS allowed, " +
        "profitia_request_inspection.descriptor($1::uuid,$2) AS descriptor, " +
        "txid_current()::text AS transaction_id,current_user::text AS role,session_user::text AS login" :
        "SELECT profitia_request_phases.delegated_scope_allows($1::uuid,$2,$3,$4::uuid,$5::uuid) AS allowed, " +
        "profitia_request_phases.delegated_descriptor($1::uuid,$2) AS descriptor, " +
        "txid_current()::text AS transaction_id,current_user::text AS role,session_user::text AS login",
        inspecting ? [d.requestId,d.phaseId,organizationId,d.subjectUserId] : [d.requestId,d.phaseId,d.inputDigest,organizationId,d.subjectUserId],
      );
      const row = proof.rows[0], actual = row?.descriptor;
      if (row?.allowed !== true || !actual || row.role !== row.login || actual.role !== row.role
        || actual.applicationId !== d.applicationId || actual.databaseName !== role?.database_name
        || actual.executorServiceId !== d.actorId || actual.subjectUserId !== d.subjectUserId
        || actual.organisationId !== organizationId || actual.requestId !== d.requestId || actual.phaseId !== d.phaseId
        || actual.schemaDigest !== d.schemaDigest || actual.delegatedSchemaDigest !== d.delegatedSchemaDigest
        || inspecting && (actual.effect !== 'PRIVATE_SQL_READ' || actual.inspectionSchemaDigest !== d.inspectionSchemaDigest
          || actual.acceptedTransactionId !== d.acceptedTransactionId || actual.inputDigest !== d.inputDigest)
        || actual.transactionId !== d.transactionId || row.transaction_id !== d.transactionId) throw new Error('SRM delegated private transaction scope mismatch');
    } else if (role?.database_name !== "srm_app") {
      // Only a server-bound transaction admitted by the private host can use a
      // new store. The ordinary runtime URL/getPool contract stays unchanged.
      if (!bound) throw new Error("SRM product database identity mismatch");
      const proof = await client.query<{ allowed: boolean; application_id: string; database_name: string }>(
        "SELECT profitia_access.scope_allows('srm',$1::uuid) AS allowed, " +
        "profitia_access.runtime_descriptor()->>'applicationId' AS application_id, " +
        "profitia_access.runtime_descriptor()->>'databaseName' AS database_name", [organizationId],
      );
      if (proof.rows[0]?.allowed !== true || proof.rows[0]?.application_id !== "srm"
        || proof.rows[0]?.database_name !== role?.database_name) throw new Error("SRM private transaction scope mismatch");
    }
    if (role.bypass_rls || role.superuser || role.neon_superuser_member) {
      throw new Error("SRM application role must enforce row-level security");
    }
    if (bound) {
      const current = await client.query<{ organization_id: string }>("SELECT current_setting('srm.organization_id',true) AS organization_id");
      if (current.rows[0]?.organization_id !== organizationId) throw new Error("SRM bound transaction context mismatch");
    } else await client.query("SELECT set_config('srm.organization_id', $1, true)", [organizationId]);
    await atLookupStage("organization_context", async () => {
      const organization = await client.query("SELECT id FROM srm.organizations WHERE id = $1", [organizationId]);
      if (organization.rows.length !== 1) throw new Error("SRM organization must be provisioned before runtime use");
    });
    const result = await action(client);
    if (!bound) {
      await client.query("COMMIT");
      inTransaction = false;
    }
    return result;
  } catch (error) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    if (!bound) client.release();
  }
}
