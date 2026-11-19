
import {createHash} from 'node:crypto';
import {createCurrentHumanReadIdentity} from './current-human-read.mjs';
import {createAccessStore} from './access-store.mjs';
import {createSupplierWorkspaceOperationHost,privateOperationHostSourceDigest} from './private-operation-host.mjs';
import {supplierWorkspaceOperationPolicy,supplierWorkspaceSourceDigest} from './supplier-workspace-access.mjs';
import {OperationDenied,operationPayloadDigest} from './operation-context.mjs';
export const SUPPLIER_WORKSPACE_HOST_CONTRACT=Object.freeze({id:'profitia.supplier-workspace-host',version:'1.0.0'});
const deny=()=>{throw new OperationDenied('UNVERIFIED_IDENTITY')};
const unavailable=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
/** Official identity is read twice inside one operation, with final observation
 * BEFORE canonical OUTCOME/COMMIT. Only the fixed domain RPC is exposed. */
export function createSupplierWorkspaceHost(options){
 const {clerk,identity,...base}=options;
 if(!identity||base.createAuthenticator!==undefined||base.readResources!==undefined||base.prepareInputs!==undefined
  ||base.projectOutput!==undefined||base.describeOutcome!==undefined||base.binding?.service!==undefined
  ||identity.appId!=='srm'||identity.appId!==base.application?.appId||identity.environment!=='development'
  ||identity.issuer!==base.application?.identityIssuer)throw TypeError('Explicit official Supplier Workspace identity and closed host required');
 const fixed=freeze(structuredClone({application:base.application,binding:base.binding,module:base.module,identity,supplierWorkspace:base.supplierWorkspace}));
 createCurrentHumanReadIdentity({client:clerk,application:fixed.identity,resolveBinding:async()=>null,now:base.now}).close();
 const access=createAccessStore({binding:fixed.binding,now:base.now});
 const resources=({request,scope})=>{
  const policy=supplierWorkspaceOperationPolicy(request.operation);if(!policy)unavailable();
  return {resource:{id:request.resourceId,type:policy.resourceType,dataClass:'ORGANISATION_PRIVATE',
   environment:'development',ownerOrganisationId:scope.organisationId,ownerUserId:null,
   version:'supplier-workspace-namespace:1',projectionVersion:'1.0.0'}};
 };
 const validation=createSupplierWorkspaceOperationHost({...base,...fixed,createAuthenticator:()=>async()=>null,
  readResources:resources,projectOutput:v=>v,describeOutcome:v=>v?.ok===false?'NO_DATA':'SUCCEEDED'});
 return Object.freeze({contract:validation.contract,hostContract:SUPPLIER_WORKSPACE_HOST_CONTRACT,
  async execute(input){
   if(!(input?.request instanceof Request))return deny();
   const request=input.request;let current=null,actor=null,reads=0;
   const host=createSupplierWorkspaceOperationHost({...base,...fixed,
    createAuthenticator:({resolveBinding})=>{
     if(current)unavailable();
     current=createCurrentHumanReadIdentity({client:clerk,application:fixed.identity,now:base.now,resolveBinding:async key=>{
      if(++reads===1)return resolveBinding(key);
      if(reads===2)return access.resolveBinding(base.independentQuery,key);
      return unavailable();
     }});
     return async original=>{actor=await current.authenticate(original);return actor;};
    },readResources:resources,
    projectOutput:async(value,context)=>{
     request.signal.throwIfAborted();
     const fresh=await current?.revalidate(request,actor);
     if(!fresh||operationPayloadDigest(fresh)!==operationPayloadDigest(actor))deny();
     request.signal.throwIfAborted();
     return structuredClone(value);
    },describeOutcome:v=>v?.ok===false?'NO_DATA':'SUCCEEDED'});
   try{return await host.execute(input)}finally{current?.close()}
  },
 });
}
export async function supplierWorkspaceHostSourceDigest(){
 const fs=await import('node:fs');return createHash('sha256')
  .update(fs.readFileSync(new URL('./supplier-workspace-host.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./supplier-workspace-host.d.mts',import.meta.url)))
  .update(await supplierWorkspaceSourceDigest()).update(await privateOperationHostSourceDigest()).digest('hex');
}
