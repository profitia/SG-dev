/** Trusted same-statement database time is used only to validate the original
 * 30-second Source lease. The local deadline is shortened by the FULL query
 * round trip; neither small clock skew nor transport delay can extend it.
 * No authorization, binding or revocation observation is cached here. */
export function boundedDatabaseLease(descriptor,observedMs,startedMs,receivedMs){
 const observed=typeof observedMs==='number'||typeof observedMs==='string'&&/^[0-9]+(?:\.[0-9]+)?$/.test(observedMs)?Number(observedMs):NaN
 const expiry=Date.parse(descriptor?.expiresAt),remaining=expiry-observed
 if(![observed,expiry,startedMs,receivedMs].every(Number.isFinite)||receivedMs<startedMs
  ||observed<startedMs-1000||observed>receivedMs+1000||!(remaining>0&&remaining<=30000)
  ||!(expiry>receivedMs))return null
 const localExpiry=Math.floor(Math.min(expiry,startedMs+remaining))
 if(!(localExpiry>receivedMs)||localExpiry>receivedMs+30000)return null
 return {...descriptor,expiresAt:new Date(localExpiry).toISOString()}
}
