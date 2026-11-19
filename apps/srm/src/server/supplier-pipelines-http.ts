import {randomUUID} from 'node:crypto';
import {
  SUPPLIER_PIPELINES_CONTRACT as contract, SupplierPipelinesError, parseWorkspaceCommand,
  parseWorkspaceRead, operationForCommand, operationForRead, requireContractVersion,
} from './supplier-pipelines-contract';
import type {WorkspaceCommand,WorkspaceRead,WorkspaceOperation,CommandName} from './supplier-pipelines-contract';

/** Server-side composition port, not a client capability or an access decision.
 * The accepted host must verify the original request/current operation and emit
 * its final, authorised Response. This facade does not create an ALLOW, choose
 * an organisation, open a connection, or activate an unadopted runtime. */
export interface SupplierPipelinesHttpPort {
  read(request:Request,operation:WorkspaceOperation,query:WorkspaceRead,requestId:string):Promise<Response>;
  write(request:Request,operation:WorkspaceOperation,command:WorkspaceCommand,requestId:string):Promise<Response>;
  /** Wire to the existing canonical origin/verified-peer guard, never a body flag. */
  acceptsMutationOrigin(request:Request):boolean;
}
type Route = {method:string;path:RegExp;read?:WorkspaceRead['kind'];command?:CommandName;ids?:string[];query?:string[]};
const id='([^/]+)';
const routes:readonly Route[]=[
  {method:'GET',path:/^suppliers$/,read:'SUPPLIERS',query:['q','categoryId','lifecycle','cursor','limit']},
  {method:'GET',path:/^suppliers\/by-nip$/,read:'SUPPLIER_BY_NIP',query:['nip']},
  {method:'GET',path:new RegExp('^suppliers/'+id+'$'),read:'SUPPLIER_CARD',ids:['supplierId']},
  {method:'GET',path:new RegExp('^suppliers/'+id+'/pipeline-history$'),read:'HISTORY',ids:['supplierId'],query:['cursor','limit']},
  {method:'GET',path:new RegExp('^suppliers/'+id+'/adp-status$'),read:'ADP_STATUS',ids:['supplierId']},
  {method:'GET',path:/^categories$/,read:'CATEGORIES',query:['q','lifecycle','cursor','limit']},
  {method:'GET',path:/^pipelines$/,read:'PIPELINES',query:['categoryId','lifecycle','cursor','limit']},
  {method:'GET',path:new RegExp('^pipelines/'+id+'$'),read:'PIPELINE',ids:['pipelineId'],query:['cursor','limit']},
  {method:'POST',path:/^suppliers$/,command:'SUPPLIER_CREATE'},
  {method:'PATCH',path:new RegExp('^suppliers/'+id+'$'),command:'SUPPLIER_UPDATE',ids:['supplierId']},
  {method:'POST',path:new RegExp('^suppliers/'+id+'/archive$'),command:'SUPPLIER_ARCHIVE',ids:['supplierId']},
  {method:'POST',path:new RegExp('^suppliers/'+id+'/restore$'),command:'SUPPLIER_RESTORE',ids:['supplierId']},
  {method:'POST',path:/^categories$/,command:'CATEGORY_CREATE'},
  {method:'PATCH',path:new RegExp('^categories/'+id+'$'),command:'CATEGORY_UPDATE',ids:['categoryId']},
  {method:'POST',path:new RegExp('^categories/'+id+'/archive$'),command:'CATEGORY_ARCHIVE',ids:['categoryId']},
  {method:'POST',path:new RegExp('^categories/'+id+'/restore$'),command:'CATEGORY_RESTORE',ids:['categoryId']},
  {method:'PUT',path:new RegExp('^suppliers/'+id+'/categories/'+id+'$'),command:'SUPPLIER_CATEGORY_ADD',ids:['supplierId','categoryId']},
  {method:'DELETE',path:new RegExp('^suppliers/'+id+'/categories/'+id+'$'),command:'SUPPLIER_CATEGORY_REMOVE',ids:['supplierId','categoryId']},
  {method:'POST',path:/^pipelines$/,command:'PIPELINE_CREATE'},
  {method:'PATCH',path:new RegExp('^pipelines/'+id+'$'),command:'PIPELINE_UPDATE',ids:['pipelineId']},
  {method:'POST',path:new RegExp('^pipelines/'+id+'/archive$'),command:'PIPELINE_ARCHIVE',ids:['pipelineId']},
  {method:'POST',path:new RegExp('^pipelines/'+id+'/restore$'),command:'PIPELINE_RESTORE',ids:['pipelineId']},
  {method:'POST',path:new RegExp('^pipelines/'+id+'/stages$'),command:'STAGE_ADD',ids:['pipelineId']},
  {method:'PATCH',path:new RegExp('^pipelines/'+id+'/stages$'),command:'STAGES_UPDATE',ids:['pipelineId']},
  {method:'POST',path:new RegExp('^pipelines/'+id+'/stages/'+id+'/remove$'),command:'STAGE_REMOVE',ids:['pipelineId','stageId']},
  {method:'POST',path:new RegExp('^pipelines/'+id+'/memberships$'),command:'MEMBERSHIP_ADD',ids:['pipelineId']},
  {method:'PATCH',path:new RegExp('^memberships/'+id+'$'),command:'MEMBERSHIP_MOVE',ids:['membershipId']},
  {method:'POST',path:new RegExp('^memberships/'+id+'/end$'),command:'MEMBERSHIP_END',ids:['membershipId']},
  {method:'POST',path:/^supplier-pipeline-transfers$/,command:'SUPPLIER_TRANSFER'},
];
function jsonError(error:SupplierPipelinesError,requestId:string):Response {
  const response={contractId:contract.id,contractVersion:contract.version,requestId,error:{
    code:error.code,message:error.message,retryable:error.code==='UNAVAILABLE',
    ...(error.fieldErrors?{fieldErrors:error.fieldErrors}:{}),
    ...(error.existingSupplier?{existingSupplier:error.existingSupplier}:{}),
  }};
  return Response.json(response,{status:error.status,headers:{'Cache-Control':'no-store','Vary':'Cookie, Authorization'}});
}
async function readBody(request:Request):Promise<Record<string,unknown>> {
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))throw new SupplierPipelinesError('FIELD_INVALID');
  const contentLength=request.headers.get('content-length');
  if(contentLength!==null&&(!/^\d+$/.test(contentLength)||Number(contentLength)>contract.maxBodyBytes))throw new SupplierPipelinesError('BODY_TOO_LARGE');
  if(!request.body)throw new SupplierPipelinesError('FIELD_INVALID');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{
    for(;;){
      const next=await reader.read();if(next.done)break;
      size+=next.value.byteLength;
      if(size>contract.maxBodyBytes){await reader.cancel();throw new SupplierPipelinesError('BODY_TOO_LARGE');}
      chunks.push(next.value);
    }
  }finally{reader.releaseLock();}
  try{
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).sort().join(',')!=='contractVersion,data,idempotencyKey'
      ||!result.data||typeof result.data!=='object'||Array.isArray(result.data))throw Error('shape');
    return result as Record<string,unknown>;
  }catch{throw new SupplierPipelinesError('FIELD_INVALID');}
}
export function createSupplierPipelinesHttp(port:SupplierPipelinesHttpPort) {
  if(!port||[port.read,port.write,port.acceptsMutationOrigin].some(x=>typeof x!=='function'))throw TypeError('Explicit server-owned workspace host required');
  return async function supplierPipelinesHttp(request:Request):Promise<Response>{
    const requestId=randomUUID();
    try{
      const url=new URL(request.url),prefix='/api/adp/v1/';
      if(!url.pathname.startsWith(prefix))throw new SupplierPipelinesError('NOT_FOUND');
      const path=url.pathname.slice(prefix.length).replace(/\/$/,'');
      const route=routes.find(r=>r.method===request.method&&r.path.test(path));
      if(!route)throw new SupplierPipelinesError('NOT_FOUND');
      const version=request.headers.get('x-srm-contract-version');if(version!==null)requireContractVersion(version);
      const matches=route.path.exec(path)!;
      const parameters=Object.fromEntries((route.ids??[]).map((key,i)=>[key,decodeURIComponent(matches[i+1])]));
      for(const key of url.searchParams.keys()){
        if(!route.query?.includes(key)||url.searchParams.getAll(key).length!==1)throw new SupplierPipelinesError('FIELD_INVALID',{query:'Sprawdź parametry.'});
      }
      let response:Response;
      if(route.read){
        const query:Record<string,unknown>={kind:route.read,...parameters};
        for(const [key,value] of url.searchParams){
          if(key==='limit'){if(!/^[1-9]\d{0,2}$/.test(value))throw new SupplierPipelinesError('FIELD_INVALID',{limit:'Sprawdź limit.'});query.limit=Number(value);}
          else query[key]=value;
        }
        const parsed=parseWorkspaceRead(query);
        response=await port.read(request,operationForRead(parsed),parsed,requestId);
      }else{
        if(!port.acceptsMutationOrigin(request))throw new SupplierPipelinesError('FORBIDDEN');
        const body=await readBody(request),data=body.data as Record<string,unknown>;
        if(Object.keys(parameters).some(key=>Object.hasOwn(data,key)))throw new SupplierPipelinesError('FIELD_INVALID');
        const command=parseWorkspaceCommand({...body,command:route.command,data:{...data,...parameters}});
        response=await port.write(request,operationForCommand(command.command),command,requestId);
      }
      // Only the native host emits success after its final disclosure/COMMIT.
      if(!(response instanceof Response))throw new SupplierPipelinesError('UNAVAILABLE');
      const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('Vary','Cookie, Authorization');
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }catch(error){
      return jsonError(error instanceof SupplierPipelinesError?error:new SupplierPipelinesError('UNAVAILABLE'),requestId);
    }
  };
}
