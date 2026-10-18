import {EMBEDDED_COMMAND_CONTRACT,openEmbeddedCommandClient,EmbeddedCommandUnavailable} from '@profitia/platform-contracts/embedded-command-channel'
import placement from '../../deployment/native-forecast-targets.json'
import {selectNativeEmbedPage} from './native-chart-publication'
import type {NativeEmbeddedConfiguration,NativeEmbeddedSelection} from './native-embedded-read'
import {parseNativeForecastCommand,nativeForecastCommandOutcome,type NativeForecastCommandSelection,type NativeForecastCommandOutcome} from '../benchmark-forecast/native-command-presentation'

const binding=placement.environments.development.embedding
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export type NativeForecastSubmitter=Readonly<{
  submit(command:NativeForecastCommandSelection,options?:{signal?:AbortSignal}):Promise<NativeForecastCommandOutcome>
  /** Only after independently observed prepared science or terminal failure.
   * This clears local retry intent; it does not write, refund or admit work. */
  observeCompletion(command:NativeForecastCommandSelection):void
}>
export function createEmbeddedForecastSubmitter(client:Pick<ReturnType<typeof openEmbeddedCommandClient>,'submit'>,
  createId:()=>string=()=>crypto.randomUUID()):NativeForecastSubmitter{
  // Exactly24 lawful domain selections per admitted document. This volatile
  // retry registry stores no actor, credential, access result or execution queue.
  const intents=new Map<string,string>()
  return Object.freeze({async submit(command,options){
    const selected=parseNativeForecastCommand(command)
    if(!selected)return'INVALID'
    const key=JSON.stringify(selected)
    let intentId=intents.get(key)
    if(!intentId){intentId=createId();if(!uuid.test(intentId)||intents.size>=24)return'UNKNOWN';intents.set(key,intentId)}
    const request={intentId,command:selected}
    try{const result=await client.submit(request,options);return nativeForecastCommandOutcome(result.status,result.body)}
    catch(error){if(error instanceof Error&&error.name==='AbortError')throw error;return'UNKNOWN'}
  },observeCompletion(command){const selected=parseNativeForecastCommand(command);if(selected)intents.delete(JSON.stringify(selected))}})
}

/** Own fixed command handshake, bound to the already admitted read document.
 * It never supplies credentials or uses the read-only fetch adapter for a write. */
export function connectNativeEmbeddedCommand(options:{hostWindow:Window;configuration:NativeEmbeddedConfiguration;context:NativeEmbeddedSelection;
  documentId:string;onReady:(submitter:NativeForecastSubmitter)=>void;onUnavailable:()=>void}){
  const view=options.hostWindow,c=options.configuration,context=selectNativeEmbedPage(view.location.href)
  if(!c.commands||c.commands.contract!==binding.commands.contract||c.commands.configurationVersion!==binding.commands.configurationVersion
    ||c.configurationVersion!==binding.configurationVersion||c.childOrigin!==binding.childOrigin
    ||JSON.stringify(c.parentOrigins)!==JSON.stringify(binding.parentOrigins)||view.location.origin!==binding.childOrigin||view.parent===view
    ||!context||context.locale!==options.context.locale||context.seriesId!==options.context.seriesId||context.organisationId!==options.context.organisationId
    ||!uuid.test(options.documentId))throw new EmbeddedCommandUnavailable()
  const documentId=options.documentId
  let client:ReturnType<typeof openEmbeddedCommandClient>|null=null,closed=false
  const fail=()=>{if(closed)return;close();options.onUnavailable()}
  const listener=(event:MessageEvent)=>{
    if(closed||event.source!==view.parent||!binding.parentOrigins.includes(event.origin))return
    const v=event.data
    if(!v||typeof v!=='object'||Array.isArray(v)||v.type!=='profitia.dashboard-command.init')return
    if(Object.keys(v).sort().join(',')!=='documentId,instanceId,type,version'||v.version!==EMBEDDED_COMMAND_CONTRACT.version
      ||v.documentId!==documentId||typeof v.instanceId!=='string'||!uuid.test(v.instanceId)||event.ports.length!==1||client){
      for(const port of event.ports)port.close();return
    }
    try{
      client=openEmbeddedCommandClient({port:event.ports[0],instanceId:v.instanceId,onClose:()=>{if(!closed)fail()}})
      clearInterval(timer);clearTimeout(deadline);options.onReady(createEmbeddedForecastSubmitter(client))
    }catch{fail()}
  }
  const ready=()=>{if(closed||client)return;try{
    for(const origin of binding.parentOrigins)view.parent.postMessage({type:'profitia.dashboard-command.ready',version:EMBEDDED_COMMAND_CONTRACT.version,documentId},origin)
  }catch{fail()}}
  function close(){if(closed)return;closed=true;clearInterval(timer);clearTimeout(deadline);client?.close();client=null;view.removeEventListener('message',listener);view.removeEventListener('pagehide',fail)}
  view.addEventListener('message',listener);view.addEventListener('pagehide',fail)
  const timer=setInterval(ready,500),deadline=setTimeout(fail,15000);ready()
  return Object.freeze({close})
}
