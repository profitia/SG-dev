import {SaxesParser} from 'saxes'
import {nip,regon,krs,sha256} from '@profitia/krs-registry-contracts'
import {externalCallEvidence,createExternalCallHost,nativeExternalTransportSchemaDigest} from '@profitia/platform-contracts/external-call'
import type {ExternalCallOptions} from '@profitia/platform-contracts/external-call'
import type {AdmittedSourcePort} from './client.js'

export const GUS_ORIGIN='https://wyszukiwarkaregon.stat.gov.pl'
export const GUS_PATH='/wsBIR/UslugaBIRzewnPubl.svc'
const NS='http://CIS/BIR/PUBL/2014/07',DATA=NS+'/DataContract'
const ACTION=NS+'/IUslugaBIRzewnPubl/'
const cap=1024*1024
const admittedMappings=new WeakMap<object,{nip:string;requestKey:string}>()
export const gusMappingEvidence=(value:unknown)=>value&&typeof value==='object'?admittedMappings.get(value)??null:null
export type GusAction='Zaloguj'|'DaneSzukajPodmioty'|'DanePobierzPelnyRaport'|'Wyloguj'
export type GusCommand={action:GusAction;nip:string;regon:string|null;requestKey:string}
export type GusMapping={status:'MATCH';nip:string;regon:string;krs:string;register:'P';registerSymbol:'138';checkedAt:string}
 |{status:'NO_DATA'|'NO_KRS'|'NOT_KRS';reason:string}
export class GusError extends Error{
 constructor(readonly code:string,readonly category:'UNAVAILABLE'|'IDENTITY'|'AUTHORITY'='UNAVAILABLE'){super(code);this.name='GusError'}
}
const error=(code:string,category:'UNAVAILABLE'|'IDENTITY'|'AUTHORITY'='UNAVAILABLE'):never=>{throw new GusError(code,category)}
const escapeXml=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
export function gusCommand(v:unknown):GusCommand{
 if(!v||Object.getPrototypeOf(v)!==Object.prototype)return error('GUS_COMMAND_INVALID','AUTHORITY')
 const c=v as GusCommand
 if(Object.keys(c).sort().join(',')!=='action,nip,regon,requestKey'||!['Zaloguj','DaneSzukajPodmioty','DanePobierzPelnyRaport','Wyloguj'].includes(c.action)
  ||!nip(c.nip)||!(c.regon===null||regon(c.regon))||!/^[a-f0-9]{64}$/.test(c.requestKey))return error('GUS_COMMAND_INVALID','AUTHORITY')
 return Object.freeze({...c})
}
export function gusRequest(command:unknown,key:string,sid:string|null){
 const c=gusCommand(command)
 if(!/^[A-Za-z0-9]{20}$/.test(key)||sid!==null&&!/^[A-Za-z0-9]{20}$/.test(sid))return error('GUS_CREDENTIAL_INVALID','AUTHORITY')
 let args:string
 if(c.action==='Zaloguj')args='<pKluczUzytkownika>'+escapeXml(key)+'</pKluczUzytkownika>'
 else if(c.action==='DaneSzukajPodmioty')args='<pParametryWyszukiwania xmlns:d="'+DATA+'"><d:Nip>'+c.nip+'</d:Nip></pParametryWyszukiwania>'
 else if(c.action==='DanePobierzPelnyRaport'){
  if(!c.regon)return error('GUS_REGON_MISSING','IDENTITY')
  args='<pRegon>'+c.regon+'</pRegon><pNazwaRaportu>BIR12OsPrawna</pNazwaRaportu>'
 }else{
  if(!sid)return error('GUS_SESSION_MISSING','AUTHORITY')
  args='<pIdentyfikatorSesji>'+escapeXml(sid)+'</pIdentyfikatorSesji>'
 }
 const body='<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing"><s:Header><a:Action s:mustUnderstand="1">'+ACTION+c.action+'</a:Action><a:To s:mustUnderstand="1">'+GUS_ORIGIN+GUS_PATH+'</a:To></s:Header><s:Body><'+c.action+' xmlns="'+NS+'">'+args+'</'+c.action+'></s:Body></s:Envelope>'
 return {method:'POST' as const,url:GUS_ORIGIN+GUS_PATH,body}
}
/** Safe bounded namespace-aware parsing, including escaped inner BIR records.
 * DTD/entity declarations and XML external resources are never permitted. */
function fields(xml:string):Record<string,string[]>{
 if(Buffer.byteLength(xml)>cap||/<!DOCTYPE|<!ENTITY/i.test(xml))return error('GUS_XML_REFUSED')
 const result:Record<string,string[]>=Object.create(null),stack:{name:string;text:string}[]=[]
 const parser=new SaxesParser({xmlns:true})
 let count=0
 parser.on('opentag',tag=>{if(++count>10000||stack.length>=40)error('GUS_XML_REFUSED');stack.push({name:tag.local,text:''})})
 parser.on('text',text=>{if(stack.length){const top=stack[stack.length-1]!;top.text+=text;if(top.text.length>cap)error('GUS_XML_REFUSED')}})
 parser.on('cdata',text=>{if(stack.length)stack[stack.length-1]!.text+=text})
 parser.on('closetag',()=>{const v=stack.pop()!;(result[v.name]??=[]).push(v.text.trim())})
 parser.on('error',()=>error('GUS_XML_INVALID'))
 try{parser.write(xml).close()}catch(e){if(e instanceof GusError)throw e;return error('GUS_XML_INVALID')}
 return result
}
export function gusResult(bytes:Uint8Array,action:GusAction):string{
 if(bytes.byteLength>cap)return error('GUS_RESPONSE_TOO_LARGE')
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return error('GUS_ENCODING_INVALID')}
 // BIR replies may be MTOM multipart. There are no binary data attachments in
 // these four operations; isolate only the SOAP document, never MIME headers.
 const start=text.search(/<(?:[A-Za-z_][\w.-]*:)?Envelope(?:\s|>)/),end=/<\/(?:[A-Za-z_][\w.-]*:)?Envelope\s*>/g
 if(start<0)return error('GUS_ENVELOPE_MISSING')
 end.lastIndex=start;const close=end.exec(text);if(!close)return error('GUS_ENVELOPE_MISSING')
 const values=fields(text.slice(start,close.index+close[0].length))
 if(values.Fault)return error('GUS_SOAP_FAULT')
 const found=values[action+'Result'];if(found?.length!==1)return error('GUS_RESULT_INVALID')
 return found[0]!
}
function one(values:Record<string,string[]>,name:string):string|null{
 const v=values[name];if(!v?.length)return null
 if(v.length!==1)return error('GUS_AMBIGUOUS_ENTITY','IDENTITY')
 return v[0]||null
}
export function gusSearchRecord(xml:string,requestedNip:string):{regon:string}|GusMapping{
 if(!xml.trim())return {status:'NO_DATA',reason:'GUS_NO_RECORD'}
 const v=fields(xml),n=one(v,'Nip'),r=one(v,'Regon'),type=one(v,'Typ')
 if(!n&&!r)return {status:'NO_DATA',reason:'GUS_NO_RECORD'}
 if(n!==requestedNip)return error('GUS_NIP_MISMATCH','IDENTITY')
 if(type!=='P')return {status:'NO_KRS',reason:'GUS_NOT_LEGAL_ENTITY'}
 if(!r)return {status:'NO_DATA',reason:'GUS_REGON_MISSING'}
 if(!regon(r))return error('GUS_REGON_INVALID','IDENTITY')
 // Legal unit report, not an arbitrarily truncated local-unit REGON14.
 if(r.length!==9)return {status:'NO_KRS',reason:'GUS_LOCAL_UNIT_UNSUPPORTED'}
 return {regon:r}
}
export function gusFullRecord(xml:string,requestedNip:string,requestedRegon:string,now=Date.now()):GusMapping{
 if(!xml.trim())return {status:'NO_DATA',reason:'GUS_REPORT_EMPTY'}
 const v=fields(xml),n=one(v,'praw_nip'),r=one(v,'praw_regon9'),symbol=one(v,'praw_rodzajRejestruEwidencji_Symbol'),name=one(v,'praw_rodzajRejestruEwidencji_Nazwa'),number=one(v,'praw_numerWRejestrzeEwidencji')
 if(n!==requestedNip||r!==requestedRegon)return error('GUS_REPORT_IDENTITY_MISMATCH','IDENTITY')
 if(!number)return {status:'NO_KRS',reason:'GUS_KRS_MISSING'}
 if(symbol!=='138'||name?.trim().toLocaleUpperCase('pl')!=='REJESTR PRZEDSIĘBIORCÓW')return {status:'NOT_KRS',reason:'GUS_REGISTER_NOT_KRS_ENTREPRENEURS'}
 const id=/^\d{1,10}$/.test(number)?number.padStart(10,'0'):number
 if(!krs(id))return error('GUS_KRS_INVALID','IDENTITY')
 return {status:'MATCH',nip:requestedNip,regon:requestedRegon,krs:id,register:'P',registerSymbol:'138',checkedAt:new Date(now).toISOString()}
}
/** Single admitted instance owns this key in the current one-instance pilot.
 * Every session/search/report/logout counts against the same conservative limit.
 * Callers scaling that deployment must supply a shared scheduler instead. */
export function createGusRateGate(now=Date.now){
 const history:number[]=[];let queue=Promise.resolve()
 return async function permit(signal:AbortSignal){
  let release!:()=>void;const predecessor=queue;queue=new Promise<void>(resolve=>{release=resolve})
  await predecessor
  try{
   signal.throwIfAborted();let t=now();while(history.length&&history[0]!<=t-3600000)history.shift()
   let wait=history.length>=6000?history[history.length-6000]!+3600000-t:0
   const minute=history.filter(v=>v>t-60000);if(minute.length>=120)wait=Math.max(wait,minute[minute.length-120]!+60000-t)
   const second=history.filter(v=>v>t-1000);if(second.length>=3)wait=Math.max(wait,second[second.length-3]!+1000-t)
   if(wait>0)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(done,wait+1);function done(){signal.removeEventListener('abort',abort);resolve()}function abort(){clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason)}signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()})
   signal.throwIfAborted();history.push(now())
  }finally{release()}
 }
}
export function createGusMapper(options:{source:AdmittedSourcePort;now?:()=>number;permit:(signal:AbortSignal)=>Promise<void>;readSid:()=>string|null;writeSid:(value:string|null)=>void}){
 const clock=options.now??Date.now
 async function invoke(action:GusAction,n:string,r:string|null,key:string,signal:AbortSignal){
  await options.permit(signal);signal.throwIfAborted()
  const result=await options.source.execute({command:{action,nip:n,regon:r,requestKey:key},intentKey:await sha256(key+':'+action)},{signal})
  const evidence=externalCallEvidence(result)
  if(evidence?.transportProtocol!=='profitia.external-native-http'||evidence.status!=='RESPONSE'||evidence.sourceId!=='krs.registry.gus'||evidence.resourceId!=='krs-gus:nip-map')return error('GUS_SOURCE_UNVERIFIED','AUTHORITY')
  if(result.status!==200)return error('GUS_HTTP_'+result.status)
  return gusResult(result.bytes,action)
 }
 let queue:Promise<unknown>=Promise.resolve()
 async function resolve(n:string,key:string,signal:AbortSignal):Promise<GusMapping>{
  signal.throwIfAborted()
  if(!nip(n)||!/^[a-f0-9]{64}$/.test(key))return error('GUS_COMMAND_INVALID','AUTHORITY')
  let logged=false
  try{
   const sid=await invoke('Zaloguj',n,null,key,signal)
   if(!/^[A-Za-z0-9]{20}$/.test(sid))return error('GUS_LOGIN_FAILED')
   options.writeSid(sid);logged=true
   const search=gusSearchRecord(await invoke('DaneSzukajPodmioty',n,null,key,signal),n)
   if('status'in search)return search
   const mapping=Object.freeze(gusFullRecord(await invoke('DanePobierzPelnyRaport',n,search.regon,key,signal),n,search.regon,clock()))
   signal.throwIfAborted();if(mapping.status==='MATCH')admittedMappings.set(mapping,{nip:n,requestKey:key})
   return mapping
  }finally{
   if(logged){
    try{await invoke('Wyloguj',n,null,key,AbortSignal.timeout(3000))}catch{/* expiry/cleanup is separately admitted and cannot hide the original outcome */}
   }
   options.writeSid(null)
  }
 }
 return Object.freeze({resolve(n:string,key:string,signal:AbortSignal){
  const task=queue.then(()=>resolve(n,key,signal));queue=task.then(()=>undefined,()=>undefined);return task
 }})
}

/** Credentials are late server-owned values, never Source control payloads. */
export async function createAdmittedGusSource<T>(options:Omit<ExternalCallOptions<T,GusCommand>,'parseCommand'|'buildRequest'|'getHeaders'|'nativeTransport'|'publicWebTransport'> & {apiKey:string;readSid:()=>string|null}){
 if(options.binding.origin!==GUS_ORIGIN||options.binding.transport!=='HTTPS')return error('GUS_SOURCE_ORIGIN_REFUSED','AUTHORITY')
 const {apiKey,readSid,...hostOptions}=options
 const host=createExternalCallHost({...hostOptions,parseCommand:gusCommand,buildRequest:command=>gusRequest(command,apiKey,readSid()),
  getHeaders:command=>{const sid=readSid();if(command.action!=='Zaloguj'&&!sid)return error('GUS_SESSION_MISSING','AUTHORITY');return sid?{sid}:{}},
  nativeTransport:{schemaDigest:await nativeExternalTransportSchemaDigest(),credentialMode:'SERVER_HEADERS',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT',
   maximumResponseBytes:cap,redirectOrigins:[],pathRules:[{method:'POST',path:GUS_PATH,requestFormat:'SOAP'}]}})
 return Object.freeze({execute:host.execute})
}
