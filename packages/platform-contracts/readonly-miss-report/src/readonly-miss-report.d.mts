import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {PublicIdentityApplication,PublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request'
import type {OperationContext} from '@profitia/platform-contracts/operation-context'
import type {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'

export declare const READONLY_MISS_REPORT_CONTRACT:Readonly<{id:'profitia.readonly-miss-report';version:'1.0.0'}>
export type ReadonlyMissReportResult<Value>=Readonly<{status:'MISS'}>|Readonly<{status:'READY';value:Value}>
type Base<Transaction>=Parameters<typeof createPrivateOperationHost<Transaction>>[0]
export type ReadonlyMissReportReadOptions<Transaction>=Pick<Base<Transaction>,
 'application'|'binding'|'independentQuery'|'transact'|'readResources'|'projectOutput'|'transactionTimeoutMs'>
 &{module:NonNullable<Base<Transaction>['module']>&{id:'supplier_report'}}
export type ReadonlyMissReportRefreshOptions<Transaction>=ReadonlyMissReportReadOptions<Transaction>
 &Pick<Base<Transaction>,'requestLedger'|'describeOutcome'>
export type ReadonlyMissReportAction<Transaction>=(context:Readonly<OperationContext>,transaction:Transaction)=>unknown|Promise<unknown>
export type ReadonlyMissReportProbePort=Readonly<{query:import('@profitia/platform-contracts/access-store').AccessQuery}>
export type ReadonlyMissReportReadOnlyProbeOptions<Transaction>=Omit<ReadonlyMissReportReadOptions<Transaction>,'readResources'|'projectOutput'>
 &Pick<Base<ReadonlyMissReportProbePort>,'readResources'|'projectOutput'>
type Host<Transaction>=Readonly<{
 hostContract:typeof READONLY_MISS_REPORT_CONTRACT
 /** One call per factory instance. Each phase uses its real canonical SQL
  * transaction; work runs between admission COMMIT and final read BEGIN. */
 execute<Value>(input:Readonly<{request:Request;organisationId:string;nip:string;idempotencyKey:string|null}>,actions:{
   probe:ReadonlyMissReportAction<ReadonlyMissReportProbePort>;refresh:ReadonlyMissReportAction<Transaction>;read:ReadonlyMissReportAction<Transaction>
   work(selection:Readonly<{requestId:string;organisationId:string;command:Readonly<{kind:'SUPPLIER_REPORT';nip:string}>}>,signal:AbortSignal):void|Promise<void>
   /** Runs only on READY, in the ordinary transaction BEFORE fresh H2. */
   ready(value:unknown,context:Readonly<OperationContext>,transaction:Transaction):Value|Promise<Value>}
  ):Promise<Value>
}>
/** Explicitly reviewed statements; PostgreSQL enforces READ ONLY for resource,
 * probe and projection callbacks. Every probe subtransaction is rolled back.
 * No raw client, writer, Work, Source or transaction control port is provided. */
export declare function createReadonlyMissReportHost<Transaction>(options:{
 clerk:ClerkIdentityClient;identity:PublicIdentityApplication;receiverBoundary:PublicIdentityRequestBoundary;now?:()=>number
 refresh:ReadonlyMissReportRefreshOptions<Transaction>;read:ReadonlyMissReportReadOptions<Transaction>
 probe:ReadonlyMissReportReadOnlyProbeOptions<Transaction>;probeReadOnly:Readonly<{statements:readonly string[]}>
}):Host<Transaction>
export declare function readonlyMissReportSourceDigest():Promise<string>
