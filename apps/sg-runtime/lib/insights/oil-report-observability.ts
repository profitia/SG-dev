import * as Sentry from '@sentry/nextjs'
const phases=['run','source','author','validation','review'] as const
export type OilPhase=typeof phases[number]
export type OilTrace=<T>(phase:OilPhase,work:()=>Promise<T>)=>Promise<T>
/** Reuse SG Runtime's active Sentry client and its existing strict sanitizer.
 * Only static op names/status; no prompt, output, URL, identity or secret data. */
export async function traceOilReport<T>(phase:OilPhase,work:()=>Promise<T>):Promise<T>{
 if(!phases.includes(phase))return work()
 let business:Promise<T>|undefined
 const once=()=>business??=Promise.resolve().then(work)
 try{return await Sentry.startSpan({name:'oil_report.'+phase,op:'sg.oil_report.'+phase},async span=>{
  try{const value=await once();try{span.setStatus({code:1})}catch{};return value}catch(error){try{span.setStatus({code:2})}catch{};throw error}
 })}catch{return once()}
}
