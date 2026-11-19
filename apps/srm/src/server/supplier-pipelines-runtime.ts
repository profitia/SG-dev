import type pg from 'pg';
import type {PoolClient} from 'pg';
import {createSupplierWorkspaceHost} from '@profitia/platform-contracts/supplier-workspace-host';
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider';
import {WORKSPACE_OPERATIONS,SupplierPipelinesError} from './supplier-pipelines-contract';
import {createSrmNativePgDriver} from './native-pg-driver';
import type {PrivateConfiguration} from './private-runtime';
import {createSupplierPipelinesPort} from './supplier-pipelines-store';
import {createSupplierPipelinesHttp} from './supplier-pipelines-http';
import targets from '../../deployment/supplier-pipelines-targets.json';
import privateTargets from '../../deployment/private-runtime-targets.json';
type Environment=Readonly<Record<string,string|undefined>>;
export interface SupplierWorkspaceConfiguration {schemaDigest:string;sourceRef:string;configurationVersion:string}
export function supplierWorkspaceConfiguration(env:Environment,config:PrivateConfiguration):SupplierWorkspaceConfiguration|null {
 const enabled=env.PROFITIA_SUPPLIER_WORKSPACE_ENABLED??'false';
 if(enabled==='false')return null;
 const selected=targets as typeof targets&{activation:boolean;configurationVersion?:string;accessSchemaSource?:{sha256:string};admittedSourceRef?:string|null};
 if(enabled!=='true'||!selected.activation||selected.authorityBridge!=='ACCEPTED'
  ||!selected.configurationVersion||env.PROFITIA_SUPPLIER_WORKSPACE_CONFIGURATION_VERSION!==selected.configurationVersion
  ||!selected.accessSchemaSource||!/^[a-f0-9]{64}$/.test(selected.accessSchemaSource.sha256)
  ||!selected.admittedSourceRef||!/^[a-f0-9]{40}$/.test(selected.admittedSourceRef)
  ||env.PROFITIA_SUPPLIER_WORKSPACE_SOURCE_REF!==selected.admittedSourceRef
  ||env.RENDER_SERVICE_ID!==selected.binding.serviceId||config.binding.applicationId!=='srm'||config.binding.environment!=='development'
  ||config.binding.projectId!==selected.binding.projectId||config.binding.branchId!==selected.binding.branchId
  ||config.binding.databaseName!==selected.binding.databaseName||config.binding.role!==selected.binding.runtimeRole)
  throw new SupplierPipelinesError('UNAVAILABLE');
 return Object.freeze({schemaDigest:selected.accessSchemaSource.sha256,sourceRef:selected.admittedSourceRef,configurationVersion:selected.configurationVersion});
}
/** Reuses the existing ordinary 3+1 pool budget and native transaction driver.
 * The shared producer owns identity, Access, sealed SQL scope and final output. */
export function createSupplierPipelinesRuntime(options:Readonly<{
 config:PrivateConfiguration;pool:pg.Pool;auditPool:pg.Pool;clerk:ClerkIdentityClient;workspace:SupplierWorkspaceConfiguration;
}>) {
 const {config,workspace}=options;
 const excluded=privateTargets.environments.development.summaryPeerRead.sourceOrigin;
 // E2 peer ingress needs its own accepted bridge. Ordinary SRM API keeps the
 // existing boundary and cannot select SG2 ingress by changing Host or URL.
 const identity={...config.identity,...(config.identity.requestBoundary?{requestBoundary:{
  ...config.identity.requestBoundary,publicOrigins:config.identity.requestBoundary.publicOrigins.filter(origin=>origin!==excluded),
 }}:{})};
 const host=createSupplierWorkspaceHost<PoolClient>({
  ...createSrmNativePgDriver(options.pool,options.auditPool),clerk:options.clerk,identity,
  application:{...config.application,configurationVersion:workspace.configurationVersion,
   features:['supplier_workspace'],operations:[...WORKSPACE_OPERATIONS]},
  binding:config.binding,module:{...config.module,id:'supplier_workspace'},
  supplierWorkspace:{schemaDigest:workspace.schemaDigest,sourceRef:workspace.sourceRef},
 });
 const port=createSupplierPipelinesPort({host,defaultOrganisationId:config.application.organisationId??null,
  acceptsMutationOrigin(request){
   if(request.headers.get('sec-fetch-site')==='cross-site')return false;
   const origin=request.headers.get('origin');
   if(origin===null)return /^Bearer [^\s]+$/i.test(request.headers.get('authorization')??'');
   try{return origin===new URL(request.url).origin&&origin!==excluded
    &&identity.authorizedParties.includes(origin)}catch{return false}
  }});
 return Object.freeze({handle:createSupplierPipelinesHttp(port)});
}
export type SupplierPipelinesRuntime=ReturnType<typeof createSupplierPipelinesRuntime>;
