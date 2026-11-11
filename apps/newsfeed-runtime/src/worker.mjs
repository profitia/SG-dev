/** In-process backend worker. Runs independently of any browser, across
 * restarts through durable PostgreSQL claims. No retry of uncertain upstream
 * effects and no provider quota or billing policy is introduced here. */
export function createMonitoringWorker({monitoring,pollMs=30000,log=(_line)=>{}}){
 if(!monitoring||!['candidates','claim','execute'].every(k=>typeof monitoring[k]==='function')||!Number.isSafeInteger(pollMs)||pollMs<1000)throw TypeError('Installed durable monitoring required');
 let stopping=false,running=null,timer=null,controller=null;
 const event=outcome=>{try{log(JSON.stringify({event:'newsfeed_monitoring',outcome}))}catch{}};
 async function tick(){
  if(stopping)return;if(running)return running;
  controller=new AbortController();
  running=(async()=>{try{
   const candidates=await monitoring.candidates();
   for(const candidate of candidates){if(stopping)break;const job=await monitoring.claim(candidate);if(!job)continue;
    try{await monitoring.execute(job,{signal:controller.signal});event('COMPLETED')}
    catch{event('NOT_CONFIRMED')}
   }
  }catch{event('UNAVAILABLE')}})();
  try{return await running}finally{running=null;controller=null}
 }
 return Object.freeze({tick,
 start(){if(timer||stopping)return;void tick();timer=setInterval(()=>void tick(),pollMs);timer.unref()},
 async stop(){stopping=true;if(timer)clearInterval(timer);timer=null;controller?.abort();await running;}
 });
}

