import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {diagnosticRun} from './diagnostic-trace'

const MAX_JSON_BYTES=32*1024*1024
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
function freeze<T>(value:T):T{
 if(typeof value==='number'&&!Number.isFinite(value))return refuse()
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}
 return value
}

/** A private, finite, immutable data copy before any await. Hash only when a
 * Work manifest actually needs it; returned datasets do not need a spare hash.
 * No identity, permission observation or ALLOW decision is cached. Required
 * manifest hashes remain in the original input-capture and common SDK path. */
export function capturePrivateWorkJson<T>(value:T):T{
 return diagnosticRun('JSON_CAPTURE',()=>{
  let text:string|undefined
  try{text=JSON.stringify(value,(_key,v)=>{if(typeof v==='number'&&!Number.isFinite(v))return refuse();return v})}catch{return refuse()}
  if(!text||Buffer.byteLength(text)>MAX_JSON_BYTES)return refuse()
  const captured=freeze(JSON.parse(text) as T)
  return captured
 })
}
