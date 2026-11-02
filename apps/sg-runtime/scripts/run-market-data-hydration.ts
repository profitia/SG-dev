import './load-env'
import {createMarketHistoryRuntime,readMarketHistoryConfiguration} from '@/lib/market-data/history-runtime'
import {seriesName} from '@/lib/market-data/history-contract'
const arg=(name:string)=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3)
async function main(){
 const runId=arg('runId'),ids=arg('seriesIds'),due=arg('dueBefore'),after=arg('after')??'',limit=Number(arg('limit')??100)
 if(!runId||!/^[A-Za-z0-9_.:-]{1,128}$/.test(runId)||Boolean(ids)===Boolean(due)||!Number.isInteger(limit)||limit<1||limit>200)throw Error('A durable runId and either seriesIds or dueBefore are required')
 const selected=ids?[...new Set(ids.split(',').map(v=>seriesName.parse(v.trim())))]:undefined
 const config=readMarketHistoryConfiguration();if(!config)throw Error('Accepted native Market Data history operation is not activated')
 await import('../sentry.server.config')
 const runtime=createMarketHistoryRuntime(config),startedAt=new Date().toISOString()
 try{
  const series=selected??await runtime.dueSeries(after,due!,limit),results=[]
  for(const id of series){try{const r=await runtime.refresh(id,runId);results.push({seriesId:id,status:r.receipt.status,replayed:r.replayed,changedObservationCount:r.receipt.changedObservationCount,storedObservationCount:r.receipt.storedObservationCount,latestObservationDate:r.receipt.latestObservationDate,effectId:r.receipt.effectId})}
   catch(error){results.push({seriesId:id,status:'FAILED',reason:error instanceof Error&&error.name==='OperationDenied'?'AUTHORIZATION_UNAVAILABLE':'HISTORY_OPERATION_UNAVAILABLE'});process.exitCode=1}}
  console.log(JSON.stringify({operation:'SG2_CANONICAL_MARKET_HISTORY_V1',runId,startedAt,completedAt:new Date().toISOString(),results,nextAfter:due&&series.length===limit?series.at(-1):null,automaticRetry:false},null,2))
 }finally{await runtime.close()}
}
main().catch(()=>{console.error('Canonical Market Data history operation unavailable; no privileged or provider fallback attempted.');process.exitCode=1})
