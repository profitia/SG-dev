import {closed,demand,krs,calendarDate,parseJson,instant} from '@profitia/krs-registry-contracts'
import type {RegistryCommand} from '@profitia/krs-registry-contracts'
import type {NativeExternalResult} from '@profitia/platform-contracts/external-call'
import {RegistryError} from './errors.js'
export const KRS_ORIGIN='https://api-krs.ms.gov.pl'
export function parseCommand(value:unknown):RegistryCommand{
  const op=(value as {operation?:unknown})?.operation
  if(op==='CURRENT'||op==='FULL'){
    const c=closed(value,['operation','krs','register']);demand(krs(c.krs)&&['P','S'].includes(c.register as string),'INVALID_KRS');return c as unknown as RegistryCommand
  }
  if(op==='DAILY'||op==='HOURLY'){
    const c=closed(value,op==='DAILY'?['operation','day']:['operation','day','from','to'])
    demand(calendarDate(c.day)&&c.day>'2021-12-08','INVALID_BULLETIN_DAY')
    if(op==='HOURLY')demand(Number.isInteger(c.from)&&Number.isInteger(c.to)&&(c.from as number)>=0&&(c.to as number)<=23&&(c.from as number)<(c.to as number),'INVALID_HOUR_WINDOW')
    return c as unknown as RegistryCommand
  }
  throw new RegistryError('INVALID_COMMAND')
}
export function buildRequest(value:unknown):{method:'GET';url:string;body:null}{
  const c=parseCommand(value),url=new URL(KRS_ORIGIN)
  if('krs' in c){
    url.pathname=`/api/krs/${c.operation==='CURRENT'?'OdpisAktualny':'OdpisPelny'}/${c.krs}`;url.searchParams.set('rejestr',c.register);url.searchParams.set('format','json')
  }else{url.pathname=`/api/Krs/${c.operation==='DAILY'?'Biuletyn':'BiuletynGodzinowy'}/${c.day}`;if(c.operation==='HOURLY'){url.searchParams.set('godzinaOd',String(c.from).padStart(2,'0'));url.searchParams.set('godzinaDo',String(c.to).padStart(2,'0'))}}
  return {method:'GET',url:url.href,body:null}
}
export type AdmittedSourcePort={execute(input:{command:unknown;intentKey:string},options?:{signal?:AbortSignal}):Promise<Readonly<NativeExternalResult>>}
export function createKrsClient(options:{source?:AdmittedSourcePort;externalEnabled?:boolean;now?:()=>number;maximumCalls?:number;timeoutMs?:number;maximumBytes?:number}={}){
  let calls=0,inFlight=false,failures=0,openUntil=0
  const now=options.now??Date.now,limit=options.maximumCalls??20,timeout=options.timeoutMs??20000,cap=options.maximumBytes??4*1024*1024
  demand(Number.isInteger(limit)&&limit>0&&limit<=1000&&timeout>0&&timeout<=20000&&cap>0&&cap<=4*1024*1024)
  return Object.freeze({
    async get(value:unknown,intentKey:string):Promise<{bytes:Uint8Array;retrievedAt:string}>{
      const command=parseCommand(value);demand(typeof intentKey==='string'&&intentKey.length>0&&intentKey.length<=256)
      if(!options.externalEnabled||!options.source)throw new RegistryError('SOURCE_ADMISSION_UNAVAILABLE')
      if(inFlight||calls>=limit||now()<openUntil)throw new RegistryError('SOURCE_BUDGET_OR_CIRCUIT_DENIED')
      const signal=AbortSignal.timeout(timeout);calls++;inFlight=true;let dispatched=false
      try{
        let onAbort:()=>void=()=>{}
        const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(new RegistryError('SOURCE_TIMEOUT',null,'UNVERIFIED'));signal.addEventListener('abort',onAbort,{once:true})})
        const effect=options.source.execute({command,intentKey},{signal});dispatched=true
        // A local deadline cannot claim the admitted Source effect has settled.
        void effect.finally(()=>{inFlight=false}).catch(()=>{})
        const result=await Promise.race([effect,aborted]).finally(()=>signal.removeEventListener('abort',onAbort))
        if(signal.aborted)throw new RegistryError('SOURCE_TIMEOUT',null,'UNVERIFIED')
        if(result.url!==buildRequest(command).url)throw new RegistryError('SOURCE_ORIGIN_OR_REDIRECT_DENIED')
        if(result.bytes.length>cap)throw new RegistryError('OVERSIZED_RESPONSE',null,'RESPONSE')
        if(result.status!==200){const retry=result.headers['retry-after'],retryAfter=retry&&/^\d{1,5}$/.test(retry)?new Date(now()+Number(retry)*1000).toISOString():instant(retry)?retry:null;throw new RegistryError('KRS_HTTP_'+result.status,retryAfter,'RESPONSE')}
        parseJson(new TextDecoder('utf-8',{fatal:true}).decode(result.bytes),cap)
        failures=0;return {bytes:result.bytes,retrievedAt:new Date(now()).toISOString()}
      }catch(error){failures++;if(failures>=3)openUntil=now()+60000
        if(error instanceof RegistryError)throw error
        throw new RegistryError('KRS_UNAVAILABLE',null,(error as {certainty?:string})?.certainty==='NOT_SENT'?'NOT_SENT':'UNVERIFIED')
      }finally{if(!dispatched)inFlight=false}
    },diagnostics:()=>({attempts:calls,remaining:limit-calls,circuitOpen:now()<openUntil})
  })
}
export function bulletinIds(bytes:Uint8Array):string[]{
  const items=parseJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),4*1024*1024)
  demand(Array.isArray(items)&&items.length<=100000,'INVALID_BULLETIN')
  return [...new Set(items.map(v=>{demand(typeof v==='string'&&/^\d{1,10}$/.test(v),'INVALID_BULLETIN_KRS');const padded=v.padStart(10,'0');demand(krs(padded),'INVALID_BULLETIN_KRS');return padded}))].sort()
}
