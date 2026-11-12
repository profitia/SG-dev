import {createHash,randomBytes,timingSafeEqual} from 'node:crypto'

export const ORGANISATION_INVITATION_PROOF_CONTRACT=Object.freeze({id:'profitia.organisation-invitation-proof',version:'1.0.0'})
export const ORGANISATION_INVITATION_LIFETIME_MS=7*24*60*60*1000
const prefix='sgi1_',pattern=/^sgi1_[A-Za-z0-9_-]{43}$/
const reject=()=>{throw new TypeError('Invalid organisation invitation proof')}
function tokenBytes(value){
 if(typeof value!=='string'||!pattern.test(value))return null
 const bytes=Buffer.from(value.slice(prefix.length),'base64url')
 return bytes.length===32&&prefix+bytes.toString('base64url')===value?bytes:null
}
/** Invitation proof only. It never establishes identity, session or membership.
 * Persist tokenHash and expiry; the raw token belongs only in the encrypted
 * delivery payload and the recipient link, never an audit/telemetry record.
 */
export function organisationInvitationTokenHash(value){
 const bytes=tokenBytes(value);if(!bytes)reject()
 return createHash('sha256').update('profitia.organisation-invitation-proof.v1\0').update(bytes).digest('hex')
}
export function createOrganisationInvitationProof(options={}){
 if(!options||Object.getPrototypeOf(options)!==Object.prototype||Object.keys(options).some(k=>k!=='now'))reject()
 const now=options.now??Date.now
 if(typeof now!=='function')reject()
 const timestamp=now()
 if(!Number.isSafeInteger(timestamp)||timestamp<0||timestamp>8640000000000000-ORGANISATION_INVITATION_LIFETIME_MS)reject()
 const token=prefix+randomBytes(32).toString('base64url')
 return Object.freeze({token,tokenHash:organisationInvitationTokenHash(token),expiresAt:new Date(timestamp+ORGANISATION_INVITATION_LIFETIME_MS).toISOString()})
}
export function organisationInvitationProofMatches(token,tokenHash){
 if(typeof tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(tokenHash)||!tokenBytes(token))return false
 return timingSafeEqual(Buffer.from(organisationInvitationTokenHash(token),'hex'),Buffer.from(tokenHash,'hex'))
}
function origin(value){
 if(typeof value!=='string')reject()
 let url;try{url=new URL(value)}catch{reject()}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||value!==url.origin)reject()
 return url.origin
}
/** Origins come from the receiver's reviewed configuration, never request
 * headers, a tenant slug, a redirect parameter or an invitation write body.
 * GET /invite presents the flow. Only an authenticated POST may redeem proof.
 */
export function createOrganisationInvitationLinkBuilder(options){
 if(!options||Object.getPrototypeOf(options)!==Object.prototype||Object.keys(options).sort().join(',')!=='allowedIdentityOrigins,identityOrigin'
  ||!Array.isArray(options.allowedIdentityOrigins)||options.allowedIdentityOrigins.length<1||options.allowedIdentityOrigins.length>8)reject()
 const selected=origin(options.identityOrigin),allowed=new Set(options.allowedIdentityOrigins.map(origin))
 if(!allowed.has(selected))reject()
 return Object.freeze({build(token){
  if(!tokenBytes(token))reject()
  const link=new URL('/invite',selected);link.searchParams.set('proof',token);return link.href
 }})
}
