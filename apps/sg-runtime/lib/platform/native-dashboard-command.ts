import {openEmbeddedCommandHost,EmbeddedCommandUnavailable,type EmbeddedCommandResult,type EmbeddedCommandStatus} from '@profitia/platform-contracts/embedded-command-channel'
import {readPresentationJson,type EmbeddedReadPort} from '@profitia/platform-contracts/embedded-read-channel'
import placement from '../../../dashboard-preview/deployment/native-forecast-targets.json'
import {parseNativeForecastCommand} from '../../../dashboard-preview/lib/benchmark-forecast/native-command-presentation'
import type {NativeDashboardContext} from './native-dashboard-embed'

const target=placement.environments.development.embedding,publication=target.commands
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const unavailable=(status=503):EmbeddedCommandResult=>({status:([400,401,403,404,405,409,413,429,503].includes(status)?status:503) as EmbeddedCommandStatus,body:{error:'Command unavailable.'}})

/** The parent owns token, exact frame context and one fixed same-origin API.
 * Channel payload contains no organisation, user, credential or destination. */
export function openNativeDashboardCommandHost(options:{port:EmbeddedReadPort;instanceId:string;context:NativeDashboardContext;
  getToken:()=>Promise<string|null>;fetch?:typeof fetch}){
  const context=Object.freeze({...options.context})
  if(!target.parentOrigins.includes(context.parentOrigin)||context.childOrigin!==target.childOrigin
    ||!/^[a-z0-9_./-]{1,256}$/i.test(context.seriesId)||!uuid.test(context.organisationId))throw new EmbeddedCommandUnavailable()
  const fetchCommand=options.fetch??((input,init)=>fetch(input,init))
  return openEmbeddedCommandHost({port:options.port,instanceId:options.instanceId,parseCommand:parseNativeForecastCommand,
    accept:async({intentId,command},{signal})=>{
      if(signal.aborted)return unavailable()
      const token=await options.getToken()
      if(signal.aborted)return unavailable()
      if(!token||token.length>32761||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return unavailable(401)
      const payload={kind:command.kind,modelId:command.modelId,seriesId:context.seriesId,targetSemantics:command.targetSemantics}
      const body=JSON.stringify(payload) // Already in canonical ASCII key order.
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))),n=>n.toString(16).padStart(2,'0')).join('')
      if(signal.aborted)return unavailable()
      const url=`${context.parentOrigin}/api/benchmark/forecast/requests?${new URLSearchParams({organisationId:context.organisationId})}`
      const response=await fetchCommand(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',
        'Idempotency-Key':`native_${intentId}`,'X-Profitia-Forecast-Command':publication.contract},body,cache:'no-store',credentials:'omit',redirect:'manual',referrerPolicy:'no-referrer',signal})
      if(response.status!==202){await response.body?.cancel();return unavailable(response.status)}
      if(response.url&&response.url!==url||response.headers.get('x-profitia-operation-contract')!==placement.operationContract
        ||response.headers.get('x-profitia-application')!=='spendguru'||response.headers.get('x-profitia-environment')!=='development'
        ||response.headers.get('x-profitia-forecast-projection')!==publication.projection
        ||response.headers.get('x-profitia-forecast-resource')!==`forecast-request:${digest}`
        ||response.headers.get('x-profitia-forecast-configuration')!==publication.configurationVersion
        ||response.headers.get('x-profitia-forecast-delivery')!=='DELEGATED'){
        await response.body?.cancel();return unavailable()
      }
      const value=await readPresentationJson(response,65536)
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='requestId,status'
        ||!('requestId'in value)||typeof value.requestId!=='string'||!uuid.test(value.requestId)||!('status'in value)||value.status!=='ACCEPTED')return unavailable()
      // A private request ID is unnecessary for the embedded chart. Scientific
      // progress remains a separately authorised shared prepared-data read.
      return{status:202,body:{status:'ACCEPTED'}}
    }})
}
