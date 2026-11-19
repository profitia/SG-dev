import {createHash} from 'node:crypto';
import {SupplierPipelinesError,uuid,normalizedName} from './supplier-pipelines-contract';
import type {PipelineKind,Lifecycle,WorkspaceCommand} from './supplier-pipelines-contract';

/** Business decisions only. These snapshots are loaded by the admitted store;
 * no function in this module authenticates a user or grants SQL access. */
export interface EntityState { id: string; organisationId: string; version: number; lifecycle: Lifecycle }
export interface StageState { stageId: string; name: string; order: number; deletedAt: string | null }
export interface PipelineState extends EntityState { kind: PipelineKind; categoryId: string | null; stages: readonly StageState[] }
export interface MembershipState {
  membershipId: string; organisationId: string; supplierId: string; pipelineId: string;
  stageId: string; kind: PipelineKind; version: number; endedAt: string | null;
}
function notFound():never { throw new SupplierPipelinesError('NOT_FOUND'); }
export function assertEntity(entity: EntityState | null, organisationId:string, expectedVersion?:number, active=true): asserts entity is EntityState {
  if(!entity||entity.organisationId!==organisationId)notFound();
  if(expectedVersion!==undefined&&entity.version!==expectedVersion)throw new SupplierPipelinesError('VERSION_CONFLICT');
  if(active&&entity.lifecycle!=='ACTIVE')throw new SupplierPipelinesError('RECORD_ARCHIVED');
}
export function activeStage(pipeline:PipelineState,stageId:string):StageState {
  const stage=pipeline.stages.find(x=>x.stageId===stageId&&x.deletedAt===null);
  if(!stage)notFound();
  return stage;
}
export function planStageRemoval(
  organisationId:string,pipeline:PipelineState|null,
  command:Readonly<{stageId:string;targetStageId?:string|null;expectedPipelineVersion:number;expectedCount:number}>,
  actualCount:number,
):Readonly<{stageId:string;targetStageId:string|null;movedCount:number;nextPipelineVersion:number}> {
  if(!pipeline||pipeline.organisationId!==organisationId)notFound();
  if(pipeline.version!==command.expectedPipelineVersion||actualCount!==command.expectedCount)throw new SupplierPipelinesError('PIPELINE_CHANGED');
  assertEntity(pipeline,organisationId);
  activeStage(pipeline,command.stageId);
  if(pipeline.stages.filter(x=>x.deletedAt===null).length<=1)throw new SupplierPipelinesError('LAST_STAGE');
  if(!Number.isSafeInteger(actualCount)||actualCount<0)throw new SupplierPipelinesError('UNAVAILABLE');
  const target=command.targetStageId??null;
  if(actualCount>0&&!target)throw new SupplierPipelinesError('FIELD_INVALID',{targetStageId:'Wskaż etap docelowy.'});
  if(target===command.stageId)throw new SupplierPipelinesError('FIELD_INVALID',{targetStageId:'Wybierz inny etap.'});
  if(target)activeStage(pipeline,target);
  return Object.freeze({stageId:command.stageId,targetStageId:target,movedCount:actualCount,nextPipelineVersion:pipeline.version+1});
}
export function assertNewMembership(
  organisationId:string,supplier:EntityState|null,pipeline:PipelineState|null,stageId:string,
  expectedPipelineVersion:number,existing:readonly MembershipState[],
):void {
  assertEntity(supplier,organisationId);
  if(!pipeline)notFound();
  assertEntity(pipeline,organisationId,expectedPipelineVersion);activeStage(pipeline,stageId);
  for(const membership of existing){
    if(membership.organisationId!==organisationId||membership.supplierId!==supplier.id)throw new SupplierPipelinesError('UNAVAILABLE');
    if(membership.endedAt!==null)continue;
    if(pipeline.kind==='SUPPLIER'&&membership.kind==='SUPPLIER')throw new SupplierPipelinesError('ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS');
    if(membership.pipelineId===pipeline.id)throw new SupplierPipelinesError('VERSION_CONFLICT',{supplierId:'Firma już uczestniczy w tym procesie.'});
  }
  // A CATEGORY pipeline deliberately does not consult supplier card categories.
}
export function planSupplierTransfer(
  organisationId:string,supplier:EntityState|null,source:MembershipState|null,sourcePipeline:PipelineState|null,
  target:PipelineState|null,command:Readonly<{sourceVersion:number;expectedTargetVersion:number;targetStageId:string}>,
):Readonly<{sourceMembershipId:string;sourceNextVersion:number;targetPipelineId:string;targetStageId:string;targetNextVersion:number}> {
  assertEntity(supplier,organisationId);
  if(!source||source.organisationId!==organisationId||source.supplierId!==supplier.id||!sourcePipeline||!target)notFound();
  assertEntity(sourcePipeline,organisationId);
  assertEntity(target,organisationId,command.expectedTargetVersion);
  if(source.version!==command.sourceVersion)throw new SupplierPipelinesError('VERSION_CONFLICT');
  if(source.endedAt!==null)throw new SupplierPipelinesError('VERSION_CONFLICT');
  if(source.pipelineId!==sourcePipeline.id||source.kind!=='SUPPLIER'||sourcePipeline.kind!=='SUPPLIER'
    ||target.kind!=='SUPPLIER'||sourcePipeline.id===target.id)throw new SupplierPipelinesError('FIELD_INVALID');
  activeStage(sourcePipeline,source.stageId);activeStage(target,command.targetStageId);
  return Object.freeze({sourceMembershipId:source.membershipId,sourceNextVersion:source.version+1,
    targetPipelineId:target.id,targetStageId:command.targetStageId,targetNextVersion:target.version+1});
}
export function planLifecycle(
  organisationId:string,entity:EntityState|null,command:Readonly<{expectedVersion:number;archive:boolean;expectedCount?:number}>,actualCount:number,
):Readonly<{lifecycle:Lifecycle;nextVersion:number;endActiveMemberships:boolean;reactivateMemberships:false}> {
  assertEntity(entity,organisationId,command.expectedVersion,false);
  const target:Lifecycle=command.archive?'ARCHIVED':'ACTIVE';
  if(entity.lifecycle===target)throw new SupplierPipelinesError('VERSION_CONFLICT');
  if(command.archive&&command.expectedCount!==actualCount)throw new SupplierPipelinesError('VERSION_CONFLICT');
  if(!Number.isSafeInteger(actualCount)||actualCount<0)throw new SupplierPipelinesError('UNAVAILABLE');
  return Object.freeze({lifecycle:target,nextVersion:entity.version+1,endActiveMemberships:command.archive,reactivateMemberships:false});
}
export function validateStageConfiguration(stages:readonly StageState[]):void {
  const active=stages.filter(x=>x.deletedAt===null);
  if(active.length<1)throw new SupplierPipelinesError('LAST_STAGE');
  if(active.length>50||new Set(active.map(x=>normalizedName(x.name))).size!==active.length
    ||new Set(active.map(x=>x.stageId)).size!==active.length
    ||active.some(x=>!Number.isInteger(x.order)||x.order<0||x.order>=active.length)
    ||new Set(active.map(x=>x.order)).size!==active.length)throw new SupplierPipelinesError('FIELD_INVALID');
}
function canonical(value:unknown):string {
  if(value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  }
  throw new SupplierPipelinesError('FIELD_INVALID');
}
export function commandDigest(command:WorkspaceCommand):string {
  return createHash('sha256').update(canonical({contractVersion:command.contractVersion,command:command.command,data:command.data})).digest('hex');
}
export function inspectReplay(
  command:WorkspaceCommand,receipt:Readonly<{digest:string;result:unknown}>|null,
):Readonly<{replay:false}>|Readonly<{replay:true;result:unknown}> {
  // The host must verify current access before querying this org/actor receipt.
  if(!receipt)return Object.freeze({replay:false});
  if(receipt.digest!==commandDigest(command))throw new SupplierPipelinesError('IDEMPOTENCY_CONFLICT');
  return Object.freeze({replay:true,result:receipt.result});
}
export function validateExistingSupplier(value:unknown):Readonly<{supplierId:string;displayName:string;lifecycle:Lifecycle}> {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new SupplierPipelinesError('UNAVAILABLE');
  const v=value as Record<string,unknown>;
  if(Object.keys(v).sort().join(',')!=='displayName,lifecycle,supplierId'
    ||typeof v.displayName!=='string'||v.displayName.length<1||v.displayName.length>200
    ||!['ACTIVE','ARCHIVED'].includes(v.lifecycle as string))throw new SupplierPipelinesError('UNAVAILABLE');
  return Object.freeze({supplierId:uuid(v.supplierId),displayName:v.displayName,lifecycle:v.lifecycle as Lifecycle});
}
