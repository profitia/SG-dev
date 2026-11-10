import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const cwd=fileURLToPath(new URL('../',import.meta.url))
const port=process.env.PORT??'3001'
if(!/^\d{1,5}$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('INVALID_PORT')
let stopping=false,worker,timer,failures=0
const next=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',port],{cwd,env:process.env,stdio:'inherit'})
function startWorker(){
 if(stopping)return
 worker=spawn(process.execPath,['--import','tsx','scripts/insights-worker.ts'],{cwd,env:process.env,stdio:'inherit'})
 const started=Date.now();let ended=false
 const restart=()=>{if(ended)return;ended=true;if(stopping)return;
  failures=Date.now()-started>60000?0:failures+1
  // One supervised process, bounded backoff. Job INTENT/UNKNOWN stays durable;
  // restarting the process does not re-authorize an external paid attempt.
  timer=setTimeout(startWorker,Math.min(30000,1000*2**Math.min(failures,5)))
 }
 worker.once('error',restart);worker.once('exit',restart)
}
function stop(signal='SIGTERM'){
 if(stopping)return;stopping=true;clearTimeout(timer);next.kill(signal);worker?.kill(signal)
 const deadline=setTimeout(()=>{next.kill('SIGKILL');worker?.kill('SIGKILL')},20000);deadline.unref()
}
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>stop(signal))
next.once('error',()=>{process.exitCode=1;stop()})
next.once('exit',code=>{process.exitCode=code??1;stop()})
if(process.env.INSIGHTS_REPORTS_ENABLED==='true')startWorker()
