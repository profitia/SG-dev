import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import type {Prisma} from '@prisma/client'
import {operationPayloadDigest,type OperationContext} from '@profitia/platform-contracts/operation-context'
import {readDiscoveryCommand,readDiscoveryResult,readDiscoverySelection,discoveryRequestResourceId,discoveryResultResourceId,
 persistDiscoveryRequest,readPrivateDiscovery,projectPrivateDiscovery} from '../lib/benchmark/discovery-operation'

const A=randomUUID(),B=randomUUID(),U=randomUUID(),V=randomUUID(),R=randomUUID(),VERSION=randomUUID()
const candidate={candidateId:'fixture_series',displayName:'Original series',description:null,provider:{providerCode:'MACROBOND',displayName:'Macrobond'},providerSeries:{provider:{providerCode:'MACROBOND',displayName:'Macrobond'},providerSeriesId:'fixture_series'},frequency:'monthly',currency:null,unit:null,source:null,region:null}
const command=readDiscoveryCommand({kind:'SEARCH',query:'steel'}),data={items:[candidate]}
const denied=(action:()=>unknown)=>assert.throws(action,(e:unknown)=>e instanceof Error&&e.name==='OperationDenied')
test('closed commands preserve all original Finder modes and bound the canonical intent',()=>{
 assert.deepEqual(command,{kind:'SEARCH',query:'steel',filters:[],limit:8})
 for(const value of [{kind:'METADATA'},{kind:'METADATA_VALUES',metadataKey:'Region'},{kind:'CONTEXT',seriesIds:['fixture_series']},{kind:'AI_SEARCH',prompt:'steel procurement'}])assert.equal(readDiscoveryCommand(value).kind,value.kind)
 assert.equal(discoveryRequestResourceId(command),discoveryRequestResourceId({limit:8,query:'steel',kind:'SEARCH',filters:[]}))
 assert.notEqual(discoveryRequestResourceId(command),discoveryRequestResourceId({...command,query:'copper'}))
 assert.deepEqual(readDiscoverySelection({requestId:R}),{requestId:R})
})
for(const value of [{kind:'SEARCH'},{kind:'SEARCH',query:'steel',organisationId:B},{kind:'SEARCH',query:'steel',actorId:V},
 {kind:'SEARCH',query:'x',filters:[{metadataKey:'Region',operator:'contains',value:'PL'}]},
 {kind:'SEARCH',query:'x',limit:31},{kind:'SEARCH',query:'x'.repeat(501)},{kind:'CONTEXT',seriesIds:[]},
 {kind:'AI_SEARCH',prompt:'ab'},{kind:'UNKNOWN'},{kind:'METADATA',role:'owner'}])test('refuses unbound/unknown Finder intent '+Object.keys(value).join(','),()=>denied(()=>readDiscoveryCommand(value)))
test('accessor, inherited, hidden and cyclic commands cannot execute getters or enter the payload digest',()=>{
 const accessor=Object.defineProperty({kind:'METADATA'},'query',{enumerable:true,get(){throw Error('not executed')}})
 const hidden=Object.defineProperty({kind:'METADATA'},'hidden',{value:'private',enumerable:false}),cycle:{kind:string;cycle?:unknown}={kind:'METADATA'};cycle.cycle=cycle
 for(const value of [accessor,hidden,Object.create({kind:'METADATA'}),cycle])denied(()=>readDiscoveryCommand(value))
})
test('actual original DTO is retained; foreign fields, invalid numbers, excessive results and another semantic selection are refused',()=>{
 assert.deepEqual(readDiscoveryResult(data,command),data)
 denied(()=>readDiscoveryResult({...data,organisationId:B},command))
 denied(()=>readDiscoveryResult({items:[{...candidate,accessToken:'not-a-result-field'}]},command))
 denied(()=>readDiscoveryResult({items:[{...candidate,aiScore:Infinity}]},command))
 denied(()=>readDiscoveryResult({items:Array.from({length:9},()=>candidate)},command))
 denied(()=>readDiscoveryResult({items:{foreign_series:{}}},readDiscoveryCommand({kind:'CONTEXT',seriesIds:['fixture_series']})))
})
test('request persistence uses current HUMAN reservation, canonical bytes and both owners; altered context performs no write',async()=>{
 const c={operation:'benchmark.discovery.request',applicationId:'spendguru',actorKind:'HUMAN',actorId:U,subjectUserId:U,organisationId:A,environment:'development',decisionId:randomUUID(),payload:command,payloadDigest:operationPayloadDigest(command),resourceId:discoveryRequestResourceId(command),requestReservation:{requestId:R,replay:false}} as unknown as OperationContext
 let writes=0
 const tx={$executeRawUnsafe:async(sql:string,...args:unknown[])=>{writes++;assert.match(sql,/profitia_benchmark_discovery.commands/);assert.equal(args[0],R);assert.equal(args[3],A);assert.equal(args[4],U);assert.equal(operationPayloadDigest(JSON.parse(args[8] as string)),c.payloadDigest);return 1}} as unknown as Prisma.TransactionClient
 assert.deepEqual(await persistDiscoveryRequest(c,tx),{requestId:R,status:'ACCEPTED'})
 for(const patch of [{subjectUserId:V},{actorKind:'SERVICE'},{applicationId:'srm'},{resourceId:'*'},{payloadDigest:'f'.repeat(64)},{requestReservation:{requestId:R,replay:true}}])await assert.rejects(persistDiscoveryRequest({...c,...patch} as OperationContext,tx))
 assert.equal(writes,1)
})
test('private result publication comes only from the exact current read and cannot be cloned or replayed',async()=>{
 const c={operation:'benchmark.discovery.read',applicationId:'spendguru',actorKind:'HUMAN',actorId:U,subjectUserId:U,organisationId:A,decisionId:randomUUID(),payload:{requestId:R},payloadDigest:operationPayloadDigest({requestId:R}),resourceId:discoveryResultResourceId(R),resource:{id:discoveryResultResourceId(R),ownerOrganisationId:A,ownerUserId:U,version:VERSION}} as unknown as OperationContext
 const tx={$queryRawUnsafe:async(sql:string,...args:unknown[])=>{assert.match(sql,/r\.organisation_id=\$2::uuid AND r\.user_id=\$3::uuid/);assert.deepEqual(args,[R,A,U,VERSION]);return[{command_json:command,result_json:data,retention_until:new Date(Date.now()+60000)}]}} as unknown as Prisma.TransactionClient
 const value=await readPrivateDiscovery(c,tx);assert(Object.isFrozen(value.data))
 denied(()=>projectPrivateDiscovery(structuredClone(value),c));denied(()=>projectPrivateDiscovery(value,{...c,actorId:V}));denied(()=>projectPrivateDiscovery(value,{...c,organisationId:B}));denied(()=>projectPrivateDiscovery(value,{...c,decisionId:randomUUID()}))
 const response=projectPrivateDiscovery(value,c);assert.deepEqual(await response.json(),data);assert.equal(response.headers.get('cache-control'),'private, no-store')
 denied(()=>projectPrivateDiscovery(value,c))
})
