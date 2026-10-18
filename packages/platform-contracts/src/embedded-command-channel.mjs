/** Explicit command observation, never a grant or a rollback promise. The
 * application owns stable idempotency and verifies the real backend receipt. */
import {openEmbeddedHost,openEmbeddedClient} from './embedded-channel-core.mjs'
export const EMBEDDED_COMMAND_CONTRACT=Object.freeze({id:'profitia.embedded-command',version:'1.0.0'})
export const EMBEDDED_COMMAND_LIMITS=Object.freeze({maxRequestBytes:16384,maxResponseBytes:65536,maxInFlight:1,timeoutMs:15000})
const safeStatuses=new Set([202,400,401,403,404,405,409,413,429,503])
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export class EmbeddedCommandUnavailable extends Error {
  constructor(status=503){super('Command observation unavailable.');this.name='EmbeddedCommandUnavailable';
    this.status=safeStatuses.has(status)&&status!==202?status:503;this.delivery='UNVERIFIED'}
}
const spec=Object.freeze({contract:EMBEDDED_COMMAND_CONTRACT,limits:EMBEDDED_COMMAND_LIMITS,safeStatuses,availableStatus:202,
  requestKind:'COMMAND',requestField:'commandJson',Unavailable:EmbeddedCommandUnavailable,
  unavailableJson:'{"error":"Command observation unavailable."}',cancelledMessage:'Command observation cancelled.'})
export function openEmbeddedCommandHost({parseCommand,accept,...options}){
  if(typeof parseCommand!=='function'||typeof accept!=='function')throw TypeError('Explicit command parser and acceptance required')
  return openEmbeddedHost(spec,{...options,parse:input=>{
    if(Object.keys(input).sort().join(',')!=='command,intentId'||typeof input.intentId!=='string'||!uuid.test(input.intentId)
      ||!input.command||typeof input.command!=='object'||Array.isArray(input.command))return null
    const command=parseCommand(input.command)
    return command&&typeof command==='object'&&!Array.isArray(command)?{intentId:input.intentId,command}:null
  },execute:accept})
}
export function openEmbeddedCommandClient(options){const client=openEmbeddedClient(spec,options);return Object.freeze({submit:client.request,close:client.close})}
