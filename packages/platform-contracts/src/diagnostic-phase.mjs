import {tracingChannel} from 'node:diagnostics_channel'
import {createHash} from 'node:crypto'

/** Observation only. No payload, actor, SQL, error message or authority handle is
 * supplied by this module. The normal executor remains the only executor. */
export const DIAGNOSTIC_PHASE_CHANNEL='profitia.platform.diagnostic-phase.v1'
export const DIAGNOSTIC_PHASES=Object.freeze([
 'E1_CONTEXT','E1_DESCRIPTOR','E1_SCOPE','E1_POLICY','E1_INTENT','E1_OUTCOME','E1_PROJECT','E1_AUDIT',
 'SOURCE_CALL','SOURCE_PREPARE','SOURCE_PLAN','SOURCE_ATTEMPT','SOURCE_BEFORE_SEND','SOURCE_HTTP',
 'SOURCE_BODY','SOURCE_BODY_READ','SOURCE_DECODE','SOURCE_PARSE','SOURCE_DIGEST','SOURCE_SETTLE','SOURCE_PUBLISH','SOURCE_CONFIRM',
 'KRS_CATALOG_MAIN','KRS_CATALOG_P','KRS_CATALOG_S','KRS_CATALOG_ACCEPTED','KRS_CATALOG_NIP',
 'KRS_ACCEPTED','KRS_SELECTED','KRS_RESOLVE_IDENTITY','KRS_VALIDATE_IDENTITY','KRS_CURRENT','KRS_HISTORY','KRS_DIGEST',
 'GUS_PERMIT','GUS_LOGIN','GUS_SEARCH','GUS_REPORT','GUS_LOGOUT'
])
const allowed=new Set(DIAGNOSTIC_PHASES),trace=tracingChannel(DIAGNOSTIC_PHASE_CHANNEL)
export function diagnosticAsync(category,action){
 // No observer means the original function and promise are used directly.
 if(!allowed.has(category)||!trace.hasSubscribers)return action()
 return trace.tracePromise(action,{category})
}
export function diagnosticSync(category,action){
 if(!allowed.has(category)||!trace.hasSubscribers)return action()
 return trace.traceSync(action,{category,synchronous:true})
}
export function diagnosticAuditCategory(event){
 try{return event?.phase==='INTENT'?'E1_INTENT':event?.phase==='OUTCOME'?'E1_OUTCOME':'E1_AUDIT'}catch{return 'E1_AUDIT'}
}
/** Fingerprint the observer transitively with the existing host/source receipt. */
export async function diagnosticPhaseSourceDigest(){
 const fs=await import('node:fs')
 return createHash('sha256').update(fs.readFileSync(new URL('./diagnostic-phase.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./diagnostic-phase.d.mts',import.meta.url))).digest('hex')
}
