import { EMBEDDED_READ_CONTRACT, openEmbeddedReadClient, EmbeddedReadUnavailable,
  type EmbeddedSelection } from '@profitia/platform-contracts/embedded-read-channel'
import placement from '../../deployment/native-forecast-targets.json'
import { readNativeForecastConfiguration } from '../benchmark-forecast/native-read-relay'
import { NATIVE_FORECAST_API_PATHS, selectNativeEmbedPage, selectNativeForecastRead, selectNativeMarketRead,
  mapNativeForecastRead, mapNativeMarketRead, type NativeForecastReadKind } from './native-chart-publication'

const binding = placement.environments.development.embedding
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export type NativeEmbeddedConfiguration = Readonly<{ configurationVersion: string; childOrigin: string; parentOrigins: readonly string[];
  commands?:Readonly<{contract:string;configurationVersion:string}> }>
export type NativeEmbeddedSelection = NonNullable<ReturnType<typeof selectNativeEmbedPage>>
const privateHeaders = { 'Content-Type':'application/json','Cache-Control':'private, no-store',Vary:'Cookie, Authorization' }
const refuse = (status:number) => new Response(JSON.stringify({error:'Read unavailable.'}),{status,headers:privateHeaders})
const exact = (value:unknown, keys:string[]):value is Record<string,unknown> => !!value && typeof value==='object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',')===keys.sort().join(',')

/** Neutral public presentation configuration, no identity or permission. */
export function readNativeEmbeddedConfiguration(env:Readonly<Record<string,string|undefined>>=process.env):NativeEmbeddedConfiguration|null {
  if(env.PROFITIA_NATIVE_EMBED_ENABLED!=='true'||!readNativeForecastConfiguration(env))return null
  if(env.PROFITIA_NATIVE_COMMAND_ENABLED!==undefined&&!['true','false'].includes(env.PROFITIA_NATIVE_COMMAND_ENABLED))return null
  return Object.freeze({configurationVersion:binding.configurationVersion,childOrigin:binding.childOrigin,parentOrigins:Object.freeze([...binding.parentOrigins]),
    ...(env.PROFITIA_NATIVE_COMMAND_ENABLED==='true'?{commands:Object.freeze({contract:binding.commands.contract,configurationVersion:binding.commands.configurationVersion})}:{})})
}
function validateConfiguration(value:NativeEmbeddedConfiguration) {
  if(!exact(value,['configurationVersion','childOrigin','parentOrigins',...(value?.commands===undefined?[]:['commands'])])||value.configurationVersion!==binding.configurationVersion
    ||value.childOrigin!==binding.childOrigin||!Array.isArray(value.parentOrigins)
    ||JSON.stringify(value.parentOrigins)!==JSON.stringify(binding.parentOrigins))throw new EmbeddedReadUnavailable()
  if(value.commands!==undefined&&(!exact(value.commands,['contract','configurationVersion'])||value.commands.contract!==binding.commands.contract
    ||value.commands.configurationVersion!==binding.commands.configurationVersion))throw new EmbeddedReadUnavailable()
}

export function createEmbeddedChartFetch(client:Pick<ReturnType<typeof openEmbeddedReadClient>,'read'>,
  configuration:NativeEmbeddedConfiguration, context:NativeEmbeddedSelection, onUnavailable:()=>void=()=>{}):typeof fetch {
  validateConfiguration(configuration)
  configuration=Object.freeze({...configuration,parentOrigins:Object.freeze([...configuration.parentOrigins])})
  context=Object.freeze({...context})
  return async(input,init)=>{
    let request:Request
    try {request=input instanceof Request?new Request(input,init):new Request(new URL(String(input),configuration.childOrigin),init)}catch{return refuse(400)}
    const url=new URL(request.url)
    if(url.origin!==configuration.childOrigin||url.username||url.password||url.hash)return refuse(400)
    if(request.method!=='GET')return refuse(405)
    if(request.headers.has('authorization')||request.headers.has('cookie'))return refuse(400)
    const kind=(Object.keys(NATIVE_FORECAST_API_PATHS)as NativeForecastReadKind[]).find(key=>NATIVE_FORECAST_API_PATHS[key]===url.pathname)
    const market=url.pathname==='/api/series'?selectNativeMarketRead(request):null
    const forecast=kind?selectNativeForecastRead(kind,request):null
    const selected=market??forecast
    if(!selected||selected.seriesId!==context.seriesId||selected.parameters.has('organisationId')
      &&selected.parameters.get('organisationId')!==context.organisationId)return refuse(400)
    const parameters=Object.fromEntries([...selected.parameters].filter(([key])=>!['seriesId','organisationId','verificationScope'].includes(key)))
    const selection:EmbeddedSelection={kind:market?'history':kind!,parameters}
    try {
      const result=await client.read(selection,{signal:request.signal})
      if(result.status!==200){if(result.status===401||market&&result.status===403)onUnavailable();return refuse(result.status)}
      const mapped=market?mapNativeMarketRead(result.body,market):mapNativeForecastRead(kind!,result.body,forecast!)
      if(mapped===null){onUnavailable();return refuse(503)}
      return new Response(JSON.stringify(mapped),{status:200,headers:privateHeaders})
    }catch(error){
      if(error instanceof Error&&error.name==='AbortError')throw error
      onUnavailable();return refuse(503)
    }
  }
}

export function connectNativeEmbeddedRead(options:{hostWindow:Window;configuration:NativeEmbeddedConfiguration;context:NativeEmbeddedSelection;
  onReady:(read:typeof fetch,instanceId:string,parentOrigin:string)=>void;onUnavailable:()=>void}) {
  validateConfiguration(options.configuration)
  const configuration=Object.freeze({...options.configuration,parentOrigins:Object.freeze([...options.configuration.parentOrigins])})
  const view=options.hostWindow, context=selectNativeEmbedPage(view.location.href)
  if(view.location.origin!==configuration.childOrigin||view.parent===view||!context
    ||context.locale!==options.context.locale||context.seriesId!==options.context.seriesId||context.organisationId!==options.context.organisationId)throw new EmbeddedReadUnavailable()
  const documentId=crypto.randomUUID()
  let client:ReturnType<typeof openEmbeddedReadClient>|null=null,closed=false
  const fail=()=>{if(closed)return;close();options.onUnavailable()}
  const onMessage=(event:MessageEvent)=>{
    if(closed)return
    if(event.source!==view.parent||!configuration.parentOrigins.includes(event.origin))return
    const value=event.data
    // The separately validated command controller owns this other fixed protocol.
    if(exact(value,['type','version','instanceId','documentId'])&&value.type==='profitia.dashboard-command.init')return
    if(!exact(value,['type','version','instanceId','documentId'])||value.type!=='profitia.dashboard-read.init'
      ||value.version!==EMBEDDED_READ_CONTRACT.version||value.documentId!==documentId
      ||typeof value.instanceId!=='string'||!uuid.test(value.instanceId)||event.ports.length!==1||client){
      for(const port of event.ports)port.close()
      return
    }
    try{
      client=openEmbeddedReadClient({port:event.ports[0],instanceId:value.instanceId,onClose:()=>{if(!closed)fail()}})
      clearInterval(readyTimer);clearTimeout(deadline)
      options.onReady(createEmbeddedChartFetch(client,configuration,context,fail),value.instanceId,event.origin)
    }catch{fail()}
  }
  const ready=()=>{
    if(closed||client)return
    try{for(const origin of configuration.parentOrigins)view.parent.postMessage({type:'profitia.dashboard-read.ready',version:EMBEDDED_READ_CONTRACT.version,documentId},origin)}catch{fail()}
  }
  function close(){
    if(closed)return
    closed=true;clearInterval(readyTimer);clearTimeout(deadline);client?.close();client=null
    view.removeEventListener('message',onMessage);view.removeEventListener('pagehide',fail)
  }
  view.addEventListener('message',onMessage);view.addEventListener('pagehide',fail)
  const readyTimer=setInterval(ready,500),deadline=setTimeout(fail,15000)
  ready()
  return Object.freeze({close,documentId})
}
