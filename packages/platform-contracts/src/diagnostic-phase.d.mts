export const DIAGNOSTIC_PHASE_CHANNEL:string
export const DIAGNOSTIC_PHASES:readonly string[]
export function diagnosticAsync<T>(category:string,action:()=>Promise<T>):Promise<T>
export function diagnosticSync<T>(category:string,action:()=>T):T
export function diagnosticAuditCategory(event:unknown):string
export function diagnosticPhaseSourceDigest():Promise<string>
