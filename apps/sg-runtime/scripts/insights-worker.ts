// Same application host as the HTTP routes; no operator IPC or local files.
import '../sentry.server.config'
import { getInsightsRuntime } from '../lib/insights/autonomous-runtime'
async function main(){
 const controller=new AbortController()
 for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>controller.abort())
 const runtime=await getInsightsRuntime()
 try{
  if(process.env.INSIGHTS_CONTROLLED_SCHEDULE_ONCE==='true')await runtime.tick({controlled:true})
  await runtime.serveWorker({signal:controller.signal})
 }finally{await runtime.close()}
}
main().catch(()=>{console.error('INSIGHTS_WORKER_STOPPED');process.exitCode=1})
