import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {PublicIdentityApplication,PublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request'
import type {OperationContext} from '@profitia/platform-contracts/operation-context'
import type {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'

export declare const CURRENT_FRESH_REPORT_CONTRACT:Readonly<{id:'profitia.current-fresh-report';version:'1.0.0'}>
export type CurrentFreshReportResult<Value>=Readonly<{status:'MISS'}>|Readonly<{status:'READY';value:Value}>
type Base<Transaction>=Parameters<typeof createPrivateOperationHost<Transaction>>[0]
export type CurrentFreshReportReadOptions<Transaction>=Pick<Base<Transaction>,
 'application'|'binding'|'independentQuery'|'transact'|'readResources'|'projectOutput'|'transactionTimeoutMs'>
 &{module:NonNullable<Base<Transaction>['module']>&{id:'supplier_report'}}
export type CurrentFreshReportRefreshOptions<Transaction>=CurrentFreshReportReadOptions<Transaction>
 &Pick<Base<Transaction>,'requestLedger'|'describeOutcome'>
export type CurrentFreshReportAction<Transaction>=(context:Readonly<OperationContext>,transaction:Transaction)=>unknown|Promise<unknown>
export declare function createCurrentFreshReportHost<Transaction>(options:{
 clerk:ClerkIdentityClient;identity:PublicIdentityApplication;receiverBoundary:PublicIdentityRequestBoundary;now?:()=>number
 probe:CurrentFreshReportReadOptions<Transaction>;refresh:CurrentFreshReportRefreshOptions<Transaction>;read:CurrentFreshReportReadOptions<Transaction>
}):Readonly<{
 hostContract:typeof CURRENT_FRESH_REPORT_CONTRACT
 /** One call per factory instance. Each phase uses its real canonical SQL
  * transaction; work runs between admission COMMIT and final read BEGIN. */
 execute<Value>(input:Readonly<{request:Request;organisationId:string;nip:string;idempotencyKey:string|null}>,actions:{
  probe:CurrentFreshReportAction<Transaction>;refresh:CurrentFreshReportAction<Transaction>
  work(selection:Readonly<{requestId:string;organisationId:string;command:Readonly<{kind:'SUPPLIER_REPORT';nip:string}>}>,signal:AbortSignal):void|Promise<void>
  read:CurrentFreshReportAction<Transaction>
 }):Promise<Value>
}>
export declare function currentFreshReportSourceDigest():Promise<string>
