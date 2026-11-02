import {createHash} from 'node:crypto'
import type {Prisma} from '@prisma/client'
import {createPlatformIngestionHost} from '@profitia/platform-contracts/platform-ingestion'
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {runWithBenchmarkProviderScope} from '@/lib/benchmark/provider-scope'
import {fetchMacrobondEntityMetadata,fetchMacrobondSeriesHistory} from '@/lib/benchmark/macrobond'
import {discoveryQuery} from '@/lib/benchmark/discovery-host'
import type {BenchmarkHistoricalSeriesResult} from '@/lib/benchmark/contracts'
import {createHistorySourceTransport,type HistorySourceOptions} from './history-source'
import {canonicalHistory,canonicalJson,historyDigest,HISTORY_PERSIST_SOURCE,readHistoryCommand,seriesName,MarketHistoryUnavailable} from './history-contract'
import {observeMarketHistory} from './history-observability'

type Receipt={canonicalObservationDigest:string;canonicalDescriptor:Record<string,string|null>;seriesId:string;effectId:string;historyFingerprint:string;changedObservationCount:number;storedObservationCount:number;latestObservationDate:string;status:'UPDATED'|'UNCHANGED'}
export type MarketHistoryOptions=Omit<HistorySourceOptions,'seriesId'|'operationKey'> & {boundaryDigest:string;readHistory:(seriesId:string)=>Promise<{history:BenchmarkHistoricalSeriesResult}>}
export function createMarketHistoryIngestion(options:MarketHistoryOptions){
 const {prisma,auditPrisma,readHistory}=options
 if(typeof window!=='undefined'||prisma===auditPrisma||typeof readHistory!=='function')throw new MarketHistoryUnavailable('CONFIGURATION_UNAVAILABLE')
 const fixed=structuredClone({application:options.application,binding:options.binding,external:options.external,credentials:options.credentials,boundaryDigest:options.boundaryDigest,syntheticOrigin:options.syntheticOrigin});let busy=false
 const descriptor=async()=>{
  const rows=await auditPrisma.$queryRawUnsafe<Array<{d:Record<string,unknown>}>>('SELECT profitia_market_history.runtime_descriptor() AS d'),d=rows[0]?.d,b=fixed.binding
  if(rows.length!==1||!d||d.boundaryDigest!==fixed.boundaryDigest||d.projectId!==b.projectId||d.branchId!==b.branchId||d.databaseName!==b.databaseName||d.role!==b.role||d.writerMode!=='SOURCE_EFFECT_ONLY_NO_TABLE_ACL'||d.schemaDigest!==b.schemaDigest||d.unmeteredSchemaDigest!==b.unmeteredSchemaDigest||d.applicationId!==b.applicationId||d.deploymentId!==b.deploymentId||d.configurationVersion!==b.configurationVersion||d.environment!=='development'||d.nativeSchemaVersion!=='1.0.0'||!(Date.parse(String(d.expiresAt))>Date.now()))throw new MarketHistoryUnavailable('CONFIGURATION_UNAVAILABLE')
 }
 const receipt=async(runId:string,id:string)=>{await descriptor();const rows=await auditPrisma.$queryRawUnsafe<Array<{r:Receipt|null}>>('SELECT profitia_market_history.read_receipt($1,$2) AS r',runId,id);if(rows.length!==1)throw new MarketHistoryUnavailable('PERSISTENCE_UNAVAILABLE');return rows[0].r}
 const host=createPlatformIngestionHost<Prisma.TransactionClient>({application:fixed.application,binding:fixed.binding,source:HISTORY_PERSIST_SOURCE,independentQuery:discoveryQuery(auditPrisma),transactionTimeoutMs:15000,
  transact:(work,limits)=>prisma.$transaction(tx=>work({query:discoveryQuery(tx),transaction:tx}),{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs}),
  validateSharedPayload:(value)=>{readHistoryCommand(value);return true}})
 const readback=async(runId:string,id:string,r:Receipt,expected?:BenchmarkHistoricalSeriesResult)=>observeMarketHistory('READBACK',async()=>{
  const {history}=await readHistory(id)
  if(history.providerSeries.provider.providerCode!=='MACROBOND'||history.providerSeries.providerSeriesId!==id||history.historical.length!==r.storedObservationCount)throw new MarketHistoryUnavailable('READBACK_MISMATCH')
  const digest=createHash('sha256').update(history.historical.map(p=>p.date+'='+(p.value===null?'null':p.value.toFixed(8))).join('\n')).digest('hex')
  const descriptor=Object.fromEntries(['displayName','frequency','currency','unit','source'].map(k=>[k,history[k as 'displayName']]))
  if(digest!==r.canonicalObservationDigest||canonicalJson(descriptor)!==canonicalJson(r.canonicalDescriptor))throw new MarketHistoryUnavailable('READBACK_MISMATCH')
  if(expected){const stored=new Map(history.historical.map(p=>[p.date,p.value]));for(const p of expected.historical)if(!stored.has(p.date)||stored.get(p.date)!==p.value)throw new MarketHistoryUnavailable('READBACK_MISMATCH')}
  if(!await receipt(runId,id))throw new MarketHistoryUnavailable('READBACK_MISMATCH')
  return {receipt:r,history,replayed:!expected}
 })
 return Object.freeze({
  async refresh(id:string,runId:string){
   seriesName.parse(id);if(!/^[A-Za-z0-9_.:-]{1,128}$/.test(runId)||busy)throw new MarketHistoryUnavailable('CONFIGURATION_UNAVAILABLE')
   busy=true
   try{
    const prior=await receipt(runId,id);if(prior)return await readback(runId,id,prior)
    const operationKey=createHash('sha256').update(canonicalJson({runId,seriesId:id,version:'sg2-market-history-v1'})).digest('hex')
    const source=createHistorySourceTransport({...fixed,prisma,auditPrisma,seriesId:id,operationKey})
    const acquired=await observeMarketHistory('ACQUIRE',()=>runWithBenchmarkProviderScope({macrobond:source.macrobond,openai:source.openai,loadMetadataClient:source.loadMetadataClient},async()=>{
     const metadata=await fetchMacrobondEntityMetadata(id),history=await fetchMacrobondSeriesHistory(id,{enrichDisplay:false}),e=source.evidence()
     return {history,metadata:{...metadata,...e.metadata},evidence:e}
    }))
    const command=await observeMarketHistory('VALIDATE',async()=>{const history=canonicalHistory(id,acquired.history,acquired.metadata,acquired.evidence.rawCount);return readHistoryCommand({schemaVersion:'1.0.0',runId,seriesId:id,history,metadata:acquired.metadata,historyFingerprint:historyDigest(history),acquisition:{callId:acquired.evidence.callId,responseSha256:acquired.evidence.responseSha256}})})
    await observeMarketHistory('PERSIST',()=>host.ingest({resourceId:'macrobond:'+id,payload:JSON.parse(canonicalJson(command)),idempotencyKey:'history_'+operationKey},async(_,tx,context)=>{
     const r=await tx.$queryRawUnsafe<Array<{r:Receipt}>>('SELECT profitia_market_history.apply_history($1::uuid,$2::uuid,$3) AS r',context.platformReservation?.effectId,context.decisionId,canonicalJson({sourceId:HISTORY_PERSIST_SOURCE.id,content:command}))
     if(r.length!==1||!r[0].r)throw new MarketHistoryUnavailable('PERSISTENCE_UNAVAILABLE')
    }))
    const r=await receipt(runId,id);if(!r)throw new MarketHistoryUnavailable('PERSISTENCE_UNAVAILABLE')
    return await readback(runId,id,r,command.history)
   }finally{busy=false}
  },
  async dueSeries(after:string,before:string,limit=100){return observeMarketHistory('REFRESH_DUE',async()=>{
   if(after&&!/^[a-z][a-z0-9_]{0,127}$/.test(after)||!Number.isFinite(Date.parse(before))||Date.parse(before)>Date.now()||!Number.isInteger(limit)||limit<1||limit>200)throw new MarketHistoryUnavailable('CONFIGURATION_UNAVAILABLE')
   await descriptor();const r=await auditPrisma.$queryRawUnsafe<Array<{ids:string[]}>>('SELECT profitia_market_history.due_series($1,$2::timestamptz,$3::integer) AS ids',after,before,limit)
   if(r.length!==1||!Array.isArray(r[0].ids))throw new MarketHistoryUnavailable('PERSISTENCE_UNAVAILABLE');return r[0].ids.map(id=>seriesName.parse(id))
  })},
 })
}
