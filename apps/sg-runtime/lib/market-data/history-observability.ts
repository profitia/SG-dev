import * as Sentry from '@sentry/nextjs'
export type HistoryStage='ACQUIRE'|'VALIDATE'|'PERSIST'|'READBACK'|'REFRESH_DUE'
const observe=(work:()=>void)=>{try{work()}catch{/* Telemetry never changes the operation. */}}
export async function observeMarketHistory<T>(stage:HistoryStage,action:()=>Promise<T>):Promise<T>{
 let entered=false;let result:Promise<T>|undefined
 const run=(span?:ReturnType<typeof Sentry.getActiveSpan>)=>{
  if(entered)return result!;entered=true
  result=Promise.resolve().then(action).then(value=>{observe(()=>{span?.setAttribute('market.history.outcome','SUCCEEDED');span?.setStatus({code:1})});return value},error=>{
   const denied=error?.name==='OperationDenied',source=stage==='ACQUIRE'||stage==='VALIDATE'
   observe(()=>{span?.setAttribute('market.history.outcome',denied?'DENIED':'FAILED');span?.setAttribute('market.history.reason',denied?'AUTHORIZATION':source?'SOURCE_UNAVAILABLE':'PERSISTENCE_UNAVAILABLE');span?.setStatus({code:2})})
   // Source technical exceptions already have the existing single observer.
   if(!source&&!denied&&error?.name!=='MarketHistoryUnavailable')observe(()=>Sentry.withScope(scope=>{scope.setTag('module','market_data');scope.setTag('operation','market_history_persistence');Sentry.captureException(new Error('Market history persistence operation failed'))}))
   throw error
  });return result
 }
 try{const value=await Sentry.startSpan({name:'SOURCE_HISTORY_'+stage,op:'sg.phase'},run);return entered?value:run()}
 catch(error){if(!entered)return run();return result!}
}
