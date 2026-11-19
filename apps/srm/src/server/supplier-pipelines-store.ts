import {OPERATION_CONTRACT,isOperationDenied,type OperationInput} from '@profitia/platform-contracts/operation-context';
import {SUPPLIER_PIPELINES_CONTRACT as contract,SupplierPipelinesError,uuid,type ErrorCode,type WorkspaceCommand,type WorkspaceOperation,type WorkspaceRead} from './supplier-pipelines-contract';
import {supplierPipelinesErrorResponse,type SupplierPipelinesHttpPort} from './supplier-pipelines-http';

export interface SupplierWorkspaceClosedHost {
 execute(input:OperationInput):Promise<Readonly<{decision:'ALLOW';decisionId:string;value:unknown}>>;
}
const domainCodes=new Set<ErrorCode>(['NIP_REQUIRED','INVALID_NIP','FIELD_INVALID','DUPLICATE_NIP','ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS','VERSION_CONFLICT','PIPELINE_CHANGED','IDEMPOTENCY_CONFLICT','LAST_STAGE','RECORD_ARCHIVED','NOT_FOUND','FORBIDDEN']);
function domainResult(value:unknown):{ok:true;status:number;result:unknown;replayed:boolean}|SupplierPipelinesError {
 if(!value||typeof value!=='object'||Array.isArray(value))return new SupplierPipelinesError('UNAVAILABLE');
 const v=value as Record<string,unknown>;
 if(v.ok===true&&[200,201].includes(v.status as number)&&Object.hasOwn(v,'result')&&typeof v.replayed==='boolean')
  return {ok:true,status:v.status as number,result:v.result,replayed:v.replayed};
 if(v.ok!==false||typeof v.code!=='string'||!domainCodes.has(v.code as ErrorCode))return new SupplierPipelinesError('UNAVAILABLE');
 const fields=v.fieldErrors&&typeof v.fieldErrors==='object'&&!Array.isArray(v.fieldErrors)?v.fieldErrors as Record<string,string>:undefined;
 const e=v.existingSupplier as {supplierId?:unknown;displayName?:unknown;lifecycle?:unknown}|undefined;
 const existing=e&&typeof e.supplierId==='string'&&typeof e.displayName==='string'&&['ACTIVE','ARCHIVED'].includes(e.lifecycle as string)
  ?{supplierId:uuid(e.supplierId),displayName:e.displayName,lifecycle:e.lifecycle as 'ACTIVE'|'ARCHIVED'}:undefined;
 return new SupplierPipelinesError(v.code as ErrorCode,fields,existing);
}
/** The closed producer host returns only after current authority, OUTCOME and
 * physical COMMIT. This adapter has no SQL callback or caller-selected role. */
export function createSupplierPipelinesPort(options:Readonly<{
 host:SupplierWorkspaceClosedHost;defaultOrganisationId:string|null;acceptsMutationOrigin:(request:Request)=>boolean;
}>):SupplierPipelinesHttpPort {
 const execute=async(request:Request,operation:WorkspaceOperation,payload:WorkspaceRead|WorkspaceCommand,requestId:string)=>{
  try{
   const selected=request.headers.get('x-profitia-organisation-id');
   const organisationId=uuid(selected??options.defaultOrganisationId,'organisationId');
   const reply=await options.host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
    organisationId,operation,resourceId:'supplier-workspace:'+organisationId,payload:payload as unknown as OperationInput['payload'],
    request});
   if(reply.decision!=='ALLOW'||!reply.decisionId)throw new SupplierPipelinesError('UNAVAILABLE');
   const value=domainResult(reply.value);if(value instanceof SupplierPipelinesError)throw value;
   return Response.json({contractId:contract.id,contractVersion:contract.version,requestId,serverTime:new Date().toISOString(),result:value.result},
    {status:value.status,headers:{'Cache-Control':'no-store','Vary':'Cookie, Authorization, X-Profitia-Organisation-Id',
     'X-Profitia-Decision-Id':reply.decisionId,'X-SRM-Idempotent-Replay':String(value.replayed)}});
  }catch(error){
   let safe:SupplierPipelinesError;
   if(error instanceof SupplierPipelinesError)safe=error;
   else {
    const reason=isOperationDenied(error)?error.reasonCode:'POLICY_UNAVAILABLE';
    safe=new SupplierPipelinesError(reason==='UNVERIFIED_IDENTITY'?'UNAUTHENTICATED':
     ['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(reason)?'UNAVAILABLE':'FORBIDDEN');
   }
   if(safe.code==='UNAVAILABLE')console.error('Supplier workspace operation unavailable',{requestId,reason:isOperationDenied(error)?error.reasonCode:error instanceof SupplierPipelinesError?'DOMAIN_RESULT_UNAVAILABLE':'NATIVE_HOST_UNAVAILABLE'});
   return supplierPipelinesErrorResponse(safe,requestId);
  }
 };
 return Object.freeze({read:execute,write:execute,acceptsMutationOrigin:options.acceptsMutationOrigin});
}
