import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {PublicIdentityApplication,PublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request'
import type {OperationContext} from '@profitia/platform-contracts/operation-context'
import type {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'

export declare const CURRENT_FRESH_REPORT_CONTRACT:Readonly<{id:'profitia.current-fresh-report';version:'1.1.0'}>
export type CurrentFreshReportResult<Value>=Readonly<{status:'MISS'}>|Readonly<{status:'READY';value:Value}>
type Base<Transaction>=Parameters<typeof createPrivateOperationHost<Transaction>>[0]
export type CurrentFreshReportReadOptions<Transaction>=Pick<Base<Transaction>,
 'application'|'binding'|'independentQuery'|'transact'|'readResources'|'projectOutput'|'transactionTimeoutMs'>
 &{module:NonNullable<Base<Transaction>['module']>&{id:'supplier_report'}}
export type CurrentFreshReportRefreshOptions<Transaction>=CurrentFreshReportReadOptions<Transaction>
 &Pick<Base<Transaction>,'requestLedger'|'describeOutcome'>
export type CurrentFreshReportAction<Transaction>=(context:Readonly<OperationContext>,transaction:Transaction)=>unknown|Promise<unknown>
type HostOptions<Transaction>={
 clerk:ClerkIdentityClient;identity:PublicIdentityApplication;receiverBoundary:PublicIdentityRequestBoundary;now?:()=>number
 probe:CurrentFreshReportReadOptions<Transaction>;refresh:CurrentFreshReportRefreshOptions<Transaction>;read:CurrentFreshReportReadOptions<Transaction>
}
export type CurrentFreshReportProbePort=Readonly<{query:import('@profitia/platform-contracts/access-store').AccessQuery}>
export type CurrentFreshReportReadOnlyProbeOptions<Transaction>=Omit<CurrentFreshReportReadOptions<Transaction>,'readResources'|'projectOutput'>
 &Pick<Base<CurrentFreshReportProbePort>,'readResources'|'projectOutput'>
type Actions<Transaction>={
 probe:CurrentFreshReportAction<Transaction>;refresh:CurrentFreshReportAction<Transaction>
 work(selection:Readonly<{requestId:string;organisationId:string;command:Readonly<{kind:'SUPPLIER_REPORT';nip:string}>}>,signal:AbortSignal):void|Promise<void>
 read:CurrentFreshReportAction<Transaction>
}
type Host<Transaction,ReadOnly extends boolean>=Readonly<{
 hostContract:typeof CURRENT_FRESH_REPORT_CONTRACT
 /** One call per factory instance. Each phase uses its real canonical SQL
  * transaction; work runs between admission COMMIT and final read BEGIN. */
 execute<Value>(input:Readonly<{request:Request;organisationId:string;nip:string;idempotencyKey:string|null}>,actions:ReadOnly extends true
  ?Omit<Actions<Transaction>,'probe'>&{probe:CurrentFreshReportAction<CurrentFreshReportProbePort>;
   /** Runs only on READY, in the ordinary transaction BEFORE fresh H2. */
   ready(value:unknown,context:Readonly<OperationContext>,transaction:Transaction):Value|Promise<Value>}
  :Actions<Transaction>):Promise<Value>
}>
/** Default mode preserves the original H2-on-MISS behavior. */
export declare function createCurrentFreshReportHost<Transaction>(options:HostOptions<Transaction>&{probeReadOnly?:never}):Host<Transaction,false>
/** Explicitly reviewed statements; PostgreSQL enforces READ ONLY for resource,
 * probe and projection callbacks. Every probe subtransaction is rolled back.
 * No raw client, writer, Work, Source or transaction control port is provided. */
export declare function createCurrentFreshReportHost<Transaction>(options:Omit<HostOptions<Transaction>,'probe'>&{
 probe:CurrentFreshReportReadOnlyProbeOptions<Transaction>;probeReadOnly:Readonly<{statements:readonly string[]}>
}):Host<Transaction,true>
export declare function currentFreshReportSourceDigest():Promise<string>
