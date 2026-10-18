/** Read-only presentation transport. Existing READ1.0 wire/API is unchanged. */
import {openEmbeddedHost,openEmbeddedClient,decodePresentationJson} from './embedded-channel-core.mjs'
export const EMBEDDED_READ_CONTRACT=Object.freeze({id:'profitia.embedded-read',version:'1.0.0'})
export const EMBEDDED_READ_LIMITS=Object.freeze({maxRequestBytes:16384,maxResponseBytes:8388608,maxInFlight:4,timeoutMs:15000})
const safeStatuses=new Set([200,400,401,403,404,405,409,413,429,503])
export class EmbeddedReadUnavailable extends Error {
  constructor(status=503){super('Read unavailable.');this.name='EmbeddedReadUnavailable';this.status=safeStatuses.has(status)&&status!==200?status:503}
}
const spec=Object.freeze({contract:EMBEDDED_READ_CONTRACT,limits:EMBEDDED_READ_LIMITS,safeStatuses,availableStatus:200,
  requestKind:'READ',requestField:'selectionJson',Unavailable:EmbeddedReadUnavailable,
  unavailableJson:'{"error":"Read unavailable."}',cancelledMessage:'Read cancelled.'})
export function readPresentationJson(response,maximumBytes){return decodePresentationJson(response,maximumBytes,EmbeddedReadUnavailable)}
export function openEmbeddedReadHost({parseSelection,read,...options}){
  return openEmbeddedHost(spec,{...options,parse:parseSelection,execute:read})
}
export function openEmbeddedReadClient(options){const client=openEmbeddedClient(spec,options);return Object.freeze({read:client.request,close:client.close})}
