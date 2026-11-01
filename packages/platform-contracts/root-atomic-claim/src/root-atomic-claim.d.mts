import type {createReadonlyMissReportHost,ReadonlyMissReportAction,ReadonlyMissReportProbePort} from '@profitia/platform-readonly-miss-report'
import type {DelegatedJobHostOptions} from '@profitia/platform-contracts/private-operation-host'
import type {OperationInput} from '@profitia/platform-contracts/operation-context'
import type {PlatformDeliveryPort} from '@profitia/platform-contracts/platform-ingestion'
import type {DispatchAdmission} from '@profitia/platform-contracts/delegated-job'

export declare const ROOT_ATOMIC_CLAIM_CONTRACT:Readonly<{id:'profitia.root-atomic-claim';version:'1.0.0'}>
declare const committedRootClaim:unique symbol
/** Request-local opaque identity, never an HTTP/JSON capability or an ALLOW. */
export type CommittedRootClaim=Readonly<{[committedRootClaim]:'COMMITTED_ROOT_CLAIM'}>
export interface RootAtomicClaimSelection{
 readonly requestId:string
 readonly organisationId:string
 readonly command:Readonly<{kind:'SUPPLIER_REPORT';nip:string}>
 /** Null only for canonical Root replay; retain ordinary admit/recovery there. */
 readonly rootClaim:CommittedRootClaim|null
}
type Base<Transaction>=Parameters<typeof createReadonlyMissReportHost<Transaction>>[0]
export declare function createRootAtomicClaimReportHost<Transaction>(options:Base<Transaction>&{
 atomicClaim:Readonly<{schemaDigest:string}>
}):Readonly<{
 hostContract:typeof ROOT_ATOMIC_CLAIM_CONTRACT
 execute<Value>(input:Readonly<{request:Request;organisationId:string;nip:string;idempotencyKey:string|null}>,actions:{
  probe:ReadonlyMissReportAction<ReadonlyMissReportProbePort>
  refresh:ReadonlyMissReportAction<Transaction>
  read:ReadonlyMissReportAction<Transaction>
  ready(value:unknown,context:Parameters<ReadonlyMissReportAction<Transaction>>[0],transaction:Transaction):Value|Promise<Value>
  work(selection:Readonly<RootAtomicClaimSelection>,signal:AbortSignal):void|Promise<void>
 }):Promise<Value>
}>
export declare function createRootAtomicClaimDeliveryHost<Transaction>(options:Omit<DelegatedJobHostOptions<Transaction>,'reportAdmission'|'job'>&{
 reportAdmission?:never
 job:{schemaDigest:string;targetOperation:'supplier.report.refresh';supplierSchemaDigest:string}
 sourceDelivery:Readonly<PlatformDeliveryPort>
}):Readonly<{
 hostContract:typeof ROOT_ATOMIC_CLAIM_CONTRACT
 deliver(input:OperationInput,claim:CommittedRootClaim):Promise<Readonly<{
  decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:DispatchAdmission
 }>>
}>
export declare const rootAtomicClaimSchemaUrl:string
export declare function rootAtomicClaimSchemaDigest():Promise<string>
export declare function rootAtomicClaimSourceDigest():Promise<string>
