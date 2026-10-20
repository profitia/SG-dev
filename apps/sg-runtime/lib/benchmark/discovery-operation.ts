import {createHash} from 'node:crypto'
import {z} from 'zod'
import type {Prisma} from '@prisma/client'
import {OperationDenied,operationPayloadDigest,type Json,type OperationContext} from '@profitia/platform-contracts/operation-context'

export const DISCOVERY_REQUEST_PROJECTION='sg2-discovery-request-v1'
export const DISCOVERY_RESULT_PROJECTION='sg2-private-discovery-result-v1'
export const MAX_DISCOVERY_COMMAND_BYTES=16384,MAX_DISCOVERY_RESULT_BYTES=4000000
export const discoveryUuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const publications=new WeakMap<object,{decisionId:string;payloadDigest:string}>()
const text=z.string().trim().min(1).max(500),series=z.string().trim().min(1).max(256)
const filter=z.object({metadataKey:text.max(120),operator:z.literal('equals').default('equals'),value:text.optional(),values:z.array(text).min(1).max(20).optional()}).strict()
 .refine(v=>!!v.value||!!v.values?.length)
const command=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('SEARCH'),query:text.optional(),exactSeriesId:series.optional(),filters:z.array(filter).max(20).default([]),limit:z.number().int().min(1).max(30).default(8)}).strict(),
 z.object({kind:z.literal('METADATA')}).strict(),
 z.object({kind:z.literal('METADATA_VALUES'),metadataKey:text.max(120),filters:z.array(filter).max(20).default([]),query:z.string().trim().max(500).optional(),limit:z.number().int().min(1).max(200).optional()}).strict(),
 z.object({kind:z.literal('CONTEXT'),seriesIds:z.array(series).min(1).max(8)}).strict(),
 z.object({kind:z.literal('AI_SEARCH'),prompt:z.string().trim().min(3).max(500)}).strict(),
])
export type DiscoveryCommand=z.infer<typeof command>
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
function plain(value:unknown,depth=0):void{
 if(depth>40)return refuse()
 if(value===null||['string','boolean'].includes(typeof value))return
 if(typeof value==='number'){if(!Number.isFinite(value))return refuse();return}
 if(!value||typeof value!=='object'||!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)return refuse()
 if(Reflect.ownKeys(value).length!==Object.keys(value).length+(Array.isArray(value)?1:0)
  ||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!('value'in d)))return refuse()
 Object.values(value).forEach(v=>plain(v,depth+1))
}
export function readDiscoveryCommand(value:unknown):Readonly<DiscoveryCommand>{
 plain(value);const parsed=command.safeParse(value)
 if(!parsed.success||Buffer.byteLength(JSON.stringify(parsed.data))>MAX_DISCOVERY_COMMAND_BYTES
  ||parsed.data.kind==='SEARCH'&&!parsed.data.query&&!parsed.data.exactSeriesId)return refuse()
 return freeze(parsed.data)
}
const canonical=(v:Json):string=>JSON.stringify(v===null||typeof v!=='object'?v:Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):
 Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])))
export const discoveryRequestResourceId=(value:unknown)=>'benchmark-discovery-request:'+operationPayloadDigest(readDiscoveryCommand(value))
export function discoveryResultResourceId(requestId:string){if(!discoveryUuid.test(requestId))return refuse();return 'benchmark-discovery:'+requestId}
export function readDiscoverySelection(value:unknown):Readonly<{requestId:string}>{
 plain(value);const v=z.object({requestId:z.string().regex(discoveryUuid)}).strict().safeParse(value);if(!v.success)return refuse();return Object.freeze(v.data)
}

const nullable=z.string().max(32000).nullable(),metadata=z.record(z.union([z.string().max(32000),z.array(z.string().max(32000)).max(512)]))
const entity=z.object({id:nullable,label:nullable,description:nullable,domicile:nullable,infoUrl:nullable,historyUrl:nullable,methodologyUrl:nullable,calendarUrl:nullable,lastReleaseAt:nullable,nextReleaseAt:nullable}).strict()
const semantic=z.object({primaryTitle:nullable,description:nullable,fullDescription:nullable,hierarchy:z.array(z.string().max(32000)).max(128),path:z.array(z.string().max(32000)).max(128),source:entity.nullable(),release:entity.nullable(),category:entity.nullable(),alternativeCategories:z.array(entity).max(128),concept:entity.nullable(),technicalMetadata:metadata}).strict()
const provider=z.object({providerCode:z.literal('MACROBOND'),displayName:z.string().max(500)}).strict()
const candidate=z.object({candidateId:series,displayName:z.string().max(32000),description:nullable,provider,providerSeries:z.object({provider,providerSeriesId:series,providerSeriesKey:nullable.optional()}).strict(),frequency:nullable,currency:nullable,unit:nullable,source:nullable,region:nullable,titleUnit:nullable.optional(),lastObservationDate:nullable.optional(),exactMatch:z.boolean().optional(),metadata:metadata.optional(),semanticContext:semantic.nullable().optional(),aiScore:z.number().finite().min(0).max(1).optional(),aiReason:nullable.optional(),recommendedRank:z.number().int().min(1).max(30).optional()}).strict()
const definition=z.object({key:text.max(120),label:z.string().max(32000),description:nullable,searchable:z.boolean(),featured:z.boolean(),category:z.enum(['business','technical']),controlType:z.enum(['single-select','multi-select']),allowMultipleValues:z.boolean(),providerKey:text.max(120)}).strict()
const intent=z.object({concept:text,searchTerms:z.array(text).min(1).max(5),region:nullable,market:nullable,instrumentType:nullable,currency:nullable,frequency:nullable,useCase:nullable,industryContext:nullable,interpretation:z.string().max(1000),confidence:z.number().finite().min(0).max(1)}).strict()
export function readDiscoveryResult(value:unknown,selected:Readonly<DiscoveryCommand>):Json{
 plain(value);if(Buffer.byteLength(JSON.stringify(value))>MAX_DISCOVERY_RESULT_BYTES)return refuse()
 const schema=selected.kind==='SEARCH'?z.object({items:z.array(candidate).max(selected.limit)}).strict()
  :selected.kind==='METADATA'?z.object({items:z.array(definition).max(128)}).strict()
  :selected.kind==='METADATA_VALUES'?z.object({items:z.array(z.object({value:text.max(32000),label:z.string().max(32000)}).strict()).max(20000),totalCount:z.number().int().nonnegative(),filteredCount:z.number().int().nonnegative(),query:z.string().max(500),limited:z.boolean()}).strict()
  :selected.kind==='CONTEXT'?z.object({items:z.record(semantic)}).strict():z.object({intent,candidates:z.array(candidate).max(8)}).strict()
 const parsed=schema.safeParse(value);if(!parsed.success)return refuse()
 if(selected.kind==='CONTEXT'&&Object.keys((parsed.data as {items:Record<string,unknown>}).items).some(k=>!selected.seriesIds.includes(k)))return refuse()
 return freeze(parsed.data as Json)
}

export async function persistDiscoveryRequest(context:Readonly<OperationContext>,transaction:Prisma.TransactionClient){
 const payload=readDiscoveryCommand(context.payload),reservation=context.requestReservation
 if(context.operation!=='benchmark.discovery.request'||context.applicationId!=='spendguru'||context.actorKind!=='HUMAN'
  ||context.subjectUserId!==context.actorId||!context.organisationId||!reservation||reservation.replay!==false
  ||!discoveryUuid.test(reservation.requestId)||context.resourceId!==discoveryRequestResourceId(payload)
  ||context.payloadDigest!==operationPayloadDigest(payload))return refuse()
 const body=canonical(payload as Json);if(createHash('sha256').update(body).digest('hex')!==context.payloadDigest)return refuse()
 const count=await transaction.$executeRawUnsafe('INSERT INTO profitia_benchmark_discovery.commands(request_id,application_id,environment,organisation_id,user_id,resource_id,payload_digest,decision_id,command_text) VALUES($1::uuid,$2,$3,$4::uuid,$5::uuid,$6,$7,$8::uuid,$9)',reservation.requestId,context.applicationId,context.environment,context.organisationId,context.actorId,context.resourceId,context.payloadDigest,context.decisionId,body)
 if(count!==1)return refuse();return Object.freeze({requestId:reservation.requestId,status:'ACCEPTED' as const})
}
export function projectDiscoveryRequest(value:unknown,context:Readonly<OperationContext>):Response{
 plain(value);const v=z.object({requestId:z.string().regex(discoveryUuid),status:z.literal('ACCEPTED')}).strict().safeParse(value)
 if(!v.success||context.operation!=='benchmark.discovery.request'||v.data.requestId!==context.requestReservation?.requestId)return refuse()
 return Response.json(v.data,{status:202,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Profitia-Discovery-Projection':DISCOVERY_REQUEST_PROJECTION}})
}
export async function readPrivateDiscovery(context:Readonly<OperationContext>,transaction:Prisma.TransactionClient){
 const {requestId}=readDiscoverySelection(context.payload)
 if(context.operation!=='benchmark.discovery.read'||context.actorKind!=='HUMAN'||context.subjectUserId!==context.actorId
  ||!context.organisationId||context.resource.ownerUserId!==context.actorId||context.resource.ownerOrganisationId!==context.organisationId
  ||context.resourceId!==discoveryResultResourceId(requestId)||!discoveryUuid.test(context.resource.version))return refuse()
 const rows=await transaction.$queryRawUnsafe<Array<{command_json:unknown;result_json:unknown;retention_until:Date}>>('SELECT c.command_json,r.result_json,r.retention_until FROM profitia_benchmark_discovery.results r JOIN profitia_benchmark_discovery.commands c USING(request_id,application_id,environment,organisation_id,user_id) WHERE r.request_id=$1::uuid AND r.organisation_id=$2::uuid AND r.user_id=$3::uuid AND r.result_version=$4::uuid AND r.retention_until>clock_timestamp()',requestId,context.organisationId,context.actorId,context.resource.version)
 if(rows.length!==1)return refuse()
 const row=rows[0],value=freeze({requestId,resultVersion:context.resource.version,retentionUntil:row.retention_until.toISOString(),data:readDiscoveryResult(row.result_json,readDiscoveryCommand(row.command_json))})
 publications.set(value,{decisionId:context.decisionId,payloadDigest:context.payloadDigest});return value
}
export function projectPrivateDiscovery(value:unknown,context:Readonly<OperationContext>):Response{
 plain(value);if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='data,requestId,resultVersion,retentionUntil')return refuse()
 const v=value as Awaited<ReturnType<typeof readPrivateDiscovery>>
 const proof=publications.get(v)
 if(!proof||proof.decisionId!==context.decisionId||proof.payloadDigest!==context.payloadDigest
  ||context.operation!=='benchmark.discovery.read'||context.actorKind!=='HUMAN'||context.resource.ownerUserId!==context.actorId
  ||context.resource.ownerOrganisationId!==context.organisationId||v.resultVersion!==context.resource.version
  ||discoveryResultResourceId(v.requestId)!==context.resourceId||!Number.isFinite(Date.parse(v.retentionUntil))||Date.parse(v.retentionUntil)<=Date.now())return refuse()
 publications.delete(v)
 return Response.json(v.data,{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Profitia-Discovery-Projection':DISCOVERY_RESULT_PROJECTION,'X-Profitia-Discovery-Result':v.resultVersion}})
}
