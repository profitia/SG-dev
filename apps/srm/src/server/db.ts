import {diagnosticRun} from './diagnostic-trace'
import {instrumentDiagnosticPool} from './diagnostic-pg'
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
interface DelegatedNativeWorkScope {
  readonly kind:'NATIVE_WORK';readonly actorId:string;readonly applicationId:string;readonly subjectUserId:string
  readonly requestId:string;readonly unitId:string;readonly accessMode:'READ'|'WRITE';readonly inputDigest:string
  readonly schemaDigest:string;readonly transactionId:string;readonly policyVersion:string
  readonly policySourceRef:string;readonly policyExpiresAt:string
  readonly targetOperation:'supplier.report.refresh'|'supplier.private.refresh';readonly targetResourceId:string
}
type DelegatedPrivateScope=DelegatedPhaseScope|DelegatedNativeWorkScope
type CompanyStoreLease={active:boolean;inFlight:number};
const boundTransactions = new WeakMap<DatabasePool, { organizationId: string; client: PoolClient; delegated?: Readonly<DelegatedPrivateScope>; companyStore?:CompanyStoreLease }>();

/** Server-only capability for an already authorised, active transaction. */
export function bindOrganizationTransaction(organizationId: string, client: PoolClient, serviceContext?: Readonly<OperationContext>): DatabasePool {
  assertOrganizationId(organizationId);
  let delegated: Readonly<DelegatedPrivateScope> | undefined;
  if (serviceContext !== undefined) {
    if(serviceContext.requestWork!==undefined){
      const c=serviceContext,w=c.requestWork!,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if(c.actorKind!=='SERVICE'||c.actor?.kind!=='SERVICE'||c.actorId!==c.actor.actorId||c.actorId!==c.actor.serviceId
        ||c.operation!=='job.execute'||c.organisationId!==organizationId||!uuid.test(c.actorId)||!uuid.test(c.subjectUserId??'')
        ||!uuid.test(w.requestId)||c.resourceId!==w.requestId||c.delegation?.requestId!==w.requestId
        ||c.delegation.subjectUserId!==c.subjectUserId||c.delegation.organisationId!==organizationId
        ||!['supplier.report.refresh','supplier.private.refresh'].includes(c.delegation.target.operation)||c.delegation.target.application.appId!=='srm'
        ||c.actorId===c.subjectUserId||!/^[a-f0-9]{64}$/.test(c.payloadDigest)
        ||c.delegation.payloadDigest!==c.payloadDigest
        ||!(c.delegation.target.operation==='supplier.private.refresh'
          ?/^supplier-private-request:(COMPANY:kys|JDG:kys|JDG:jdg|COMPANY:web|JDG:web):[a-f0-9]{64}$/.test(c.delegation.target.resourceId)
          :/^supplier-request:[a-f0-9]{64}$/.test(c.delegation.target.resourceId))
        ||c.delegation.target.resourceId.split(':').at(-1)!==c.payloadDigest
        ||c.requestContinuation!==undefined||c.requestInspection!==undefined||!/^[A-Z][A-Z0-9_]{1,63}$/.test(w.unitId)
        ||!['READ','WRITE'].includes(w.accessMode)||![w.inputDigest,w.schemaDigest].every(v=>/^[a-f0-9]{64}$/.test(v))
        ||!/^[1-9][0-9]*$/.test(w.transactionId)||!/^[1-9][0-9]*$/.test(w.policyVersion)
        ||!w.policySourceRef||!Number.isFinite(Date.parse(w.policyExpiresAt))||!c.applicationId)throw Error('Explicit current native Supplier work required')
      delegated=Object.freeze({kind:'NATIVE_WORK',actorId:c.actorId,applicationId:c.applicationId,subjectUserId:c.subjectUserId!,
        requestId:w.requestId,unitId:w.unitId,accessMode:w.accessMode,inputDigest:w.inputDigest,schemaDigest:w.schemaDigest,
        transactionId:w.transactionId,policyVersion:w.policyVersion,policySourceRef:w.policySourceRef,policyExpiresAt:w.policyExpiresAt,
        targetOperation:c.delegation.target.operation as 'supplier.report.refresh'|'supplier.private.refresh',targetResourceId:c.delegation.target.resourceId})
    }else{
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
  sharedPool ??= instrumentDiagnosticPool(new pg.Pool({ connectionString, max: 8 }),'DOMAIN');
  return sharedPool;
}

export function assertOrganizationId(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("A valid organization UUID is required");
  }
}

/** One existing SRM_STORE_COMPANY action on its original native transaction.
 * Full role/Work/organisation checks bound the entire action. Inner domain
 * helpers retain row-level SQL admission and use the same exact client; they
 * cannot open another transaction or retain this pool after the action ends.
 * No account, ALLOW or SQL authority observation is cached. The native host
 * still owns fresh entry/outcome Clerk, E1 verification, audit and COMMIT. */
export async function withNativeCompanyStoreTransaction<T>(organizationId:string,
  action:(pool:DatabasePool)=>Promise<T>,pool:DatabasePool):Promise<T>{
  const original=boundTransactions.get(pool),native=original?.delegated;
  if(!original||original.companyStore||original.organizationId!==organizationId
    ||native?.kind!=='NATIVE_WORK'||native.unitId!=='SRM_STORE_COMPANY'||native.accessMode!=='WRITE'
    ||native.targetOperation!=='supplier.report.refresh'||typeof action!=='function')
    throw Error('Explicit active native company store transaction required');
  return withOrganization(organizationId,async client=>{
    if(client!==original.client)throw Error('SRM company store client mismatch');
    const lease:CompanyStoreLease={active:true,inFlight:0};
    const scoped:DatabasePool=Object.freeze({connect:async()=>{
      if(!lease.active)throw Error('SRM company store transaction scope is closed');
      return client;
    }});
    boundTransactions.set(scoped,{...original,companyStore:lease});
    let value:T;
    try{
      value=await action(scoped);
      if(lease.inFlight!==0)throw Error('SRM company store has unfinished domain actions');
    }finally{lease.active=false;}
    // Re-read the real role, native policy/scope, transaction and GUC after all
    // domain work, before either the result or the host's outcome can escape.
    await withOrganization(organizationId,async()=>undefined,pool);
    return value;
  },pool);
}

export async function withOrganization<T>(
  organizationId: string,
  action: (client: PoolClient) => Promise<T>,
  pool: DatabasePool = getPool(),
): Promise<T> {
 return diagnosticRun('WITH_ORGANIZATION',async ()=>{
  assertOrganizationId(organizationId);
  const bound = boundTransactions.get(pool);
  if (bound && bound.organizationId !== organizationId) throw new Error("SRM bound transaction organization mismatch");
  if(bound?.companyStore){
    const lease=bound.companyStore;
    if(!lease.active)throw Error('SRM company store transaction scope is closed');
    lease.inFlight++;
    try{
      const value=await action(bound.client);
      if(!lease.active)throw Error('SRM company store transaction scope is closed');
      return value;
    }finally{lease.inFlight--;}
  }
  if (!bound && process.env.TARGET_ENVIRONMENT && organizationId !== productOrganizationId()) {
    throw new Error("SRM configured organization identity mismatch");
  }
  const client = await pool.connect();
  let inTransaction = false;
  const native = bound?.delegated?.kind === 'NATIVE_WORK' ? bound.delegated : undefined;
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
      allowed?:boolean;descriptor?:Record<string,string>|null;input_digest?:string;transaction_id?:string;role?:string;login?:string;
      organization_id?:string;organization_exists?:boolean;
    }>(
      "SELECT current_database() AS database_name, r.rolbypassrls AS bypass_rls, " +
      "r.rolsuper AS superuser, pg_has_role(current_user, 'neon_superuser', 'member') AS neon_superuser_member " +
      (native ? ",profitia_request_work.scope_allows($1::uuid,$2,$3::uuid,$4::uuid,$5) AS allowed," +
        "profitia_request_work.descriptor($1::uuid,$2) AS descriptor," +
        "nullif(current_setting('profitia.native_work.scope',true),'')::jsonb->>2 AS input_digest," +
        "txid_current()::text AS transaction_id,current_user::text AS role,session_user::text AS login," +
        "current_setting('srm.organization_id',true) AS organization_id," +
        "EXISTS(SELECT 1 FROM srm.organizations WHERE id=$3::uuid) AS organization_exists " : "") +
      "FROM pg_roles r WHERE r.rolname = current_user",
      native ? [native.requestId,native.unitId,organizationId,native.subjectUserId,native.accessMode] : undefined,
    );
    const role = identity.rows[0];
    if (bound?.delegated) {
      const d = bound.delegated;
      if(d.kind==='NATIVE_WORK'){
        // The same fresh checks share one SQL statement; no settled authority
        // observation is retained for another domain action or transaction.
        const row=role,actual=row?.descriptor
        if(row?.allowed!==true||!actual||row.role!==row.login||actual.role!==row.role
          ||actual.applicationId!==d.applicationId||actual.databaseName!==role?.database_name
          ||actual.executorServiceId!==d.actorId||actual.subjectUserId!==d.subjectUserId
          ||actual.organisationId!==organizationId||actual.requestId!==d.requestId||actual.unitId!==d.unitId
          ||actual.accessMode!==d.accessMode||actual.effect!=='PRIVATE_SQL_WORK'||actual.schemaDigest!==d.schemaDigest
          ||actual.operation!==d.targetOperation||actual.resourceId!==d.targetResourceId
          ||actual.policyVersion!==d.policyVersion||actual.sourceRef!==d.policySourceRef||actual.policyExpiresAt!==d.policyExpiresAt
          ||row.input_digest!==d.inputDigest||actual.transactionId!==d.transactionId||row.transaction_id!==d.transactionId)throw Error('SRM native work transaction scope mismatch')
      }else{
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
      }
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
      const current = native ? role : (await client.query<{ organization_id: string }>("SELECT current_setting('srm.organization_id',true) AS organization_id")).rows[0];
      if (current?.organization_id !== organizationId) throw new Error("SRM bound transaction context mismatch");
    } else await client.query("SELECT set_config('srm.organization_id', $1, true)", [organizationId]);
    await atLookupStage("organization_context", async () => {
      const exists = native ? role?.organization_exists : (await client.query("SELECT id FROM srm.organizations WHERE id = $1", [organizationId])).rows.length === 1;
      if (!exists) throw new Error("SRM organization must be provisioned before runtime use");
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

 })
}
