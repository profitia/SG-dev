import { verifyWebhook } from '@clerk/backend/webhooks'
import { mailbox } from './mailgun-delivery.js'
import { isIP } from 'node:net'

/** Signed boundary. A verified event is a delivery instruction, never a
 * login session, organisation grant or proof of a sign-up avatar preference. */
export type EmailInstruction = Readonly<{
  eventId: string; emailId: string; instanceId: string; createdAt: number
  recipient: string; emailAddressId: string | null; providerUserId: string | null
  registrationAttemptId?: string
  expiresAt: number
} & ({ kind: 'verification-code'; otpCode: string } | { kind: 'invitation'; actionUrl: string; expiresInDays: number }
  | { kind:'new-device-sign-in';signInMethod:string|null;browserName:string;operatingSystem:string;location:string;ipAddress:string;sessionCreatedAt:string;revokeSessionUrl:string|null })>
export type EmailEventDecision = Readonly<
  { status: 'ignored'; reason: 'clerk-delivery' | 'unsupported-template' | 'expired' }
  | { status: 'ready'; instruction: EmailInstruction }
>
export class EmailEventRejected extends Error {
  constructor() { super('EMAIL_EVENT_REJECTED'); this.name = 'EmailEventRejected' }
}
const reject = (): never => { throw new EmailEventRejected() }
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return reject()
  return value as Record<string, unknown>
}
const id = (value: unknown, prefix: string): string => {
  if (typeof value !== 'string' || !new RegExp(`^${prefix}_[A-Za-z0-9]{4,120}$`).test(value)) return reject()
  return value
}
const optionalId = (value: unknown, prefix: string) => value === null || value === undefined ? null : id(value, prefix)

export function createClerkEmailVerifier(config: {
  environment: 'development'; instanceId: string; signingSecret: string; allowedInvitationOrigins?: readonly string[];allowedRevocationOrigins?:readonly string[]
}, now: () => number = Date.now) {
  if (config.environment !== 'development' || !/^whsec_[A-Za-z0-9+/]{24,}={0,2}$/.test(config.signingSecret)) throw new TypeError('Explicit Development webhook configuration required')
  const instanceId = id(config.instanceId, 'ins'), signingSecret = config.signingSecret
  const origins = [...(config.allowedInvitationOrigins ?? [])]
  const revokeOrigins=[...(config.allowedRevocationOrigins??[])]
  if ([...origins,...revokeOrigins].some(origin => { try { const u = new URL(origin); return u.protocol !== 'https:' || u.origin !== origin } catch { return true } })) throw Error('INVITATION_ORIGIN_CONFIGURATION')
  return async (request: Request): Promise<EmailEventDecision> => {
    try {
      if (request.method !== 'POST' || request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json'
        || request.headers.has('content-encoding')) return reject()
      const eventId = id(request.headers.get('svix-id'), 'msg')
      // Header lists/duplicates and malformed timestamps must not be normalized
      // into a valid request. The SDK checks the signature and timestamp window.
      if (!/^\d{10}$/.test(request.headers.get('svix-timestamp') ?? '')
        || (request.headers.get('svix-signature')?.length ?? 0) > 2048) return reject()
      const declaredLength = request.headers.get('content-length')
      if (declaredLength !== null && (!/^\d{1,6}$/.test(declaredLength) || Number(declaredLength) > 131072)) return reject()
      if (!request.body) return reject()
      const reader = request.body.getReader(), chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          size += chunk.value.byteLength
          if (size > 131072 || request.signal.aborted) { await reader.cancel(); return reject() }
          chunks.push(chunk.value)
        }
      } finally { reader.releaseLock() }
      if (size === 0 || declaredLength !== null && Number(declaredLength) !== size) return reject()
      // Preserve exact bytes for signature verification; never re-serialize JSON.
      const verified = await verifyWebhook(new Request(request.url, { method: 'POST', headers: request.headers,
        body: Buffer.concat(chunks), signal: request.signal }), { signingSecret })
      const event = object(verified)
      if (event.type !== 'email.created' || event.instance_id !== instanceId) return reject()
      const data = object(event.data)
      if (data.object !== 'email' || typeof data.delivered_by_clerk !== 'boolean') return reject()
      id(data.id, 'ema')
      if (data.delivered_by_clerk) return Object.freeze({ status: 'ignored', reason: 'clerk-delivery' })
      if (data.slug !== 'verification_code' && !(data.slug === 'invitation' && origins.length > 0) && !(data.slug==='new_device_sign_in'&&revokeOrigins.length>0)) return Object.freeze({ status: 'ignored', reason: 'unsupported-template' })
      const timestamp = event.timestamp
      if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp <= 0) return reject()
      // Clerk's catalog sample uses seconds; current event envelopes use ms.
      // Accept either explicitly, while the independent Svix timestamp remains
      // strictly seconds and cryptographically verified by the official SDK.
      const createdAt = timestamp < 100000000000 ? timestamp * 1000 : timestamp
      const clock = now()
      if (!Number.isSafeInteger(clock) || createdAt > clock + 30000) return reject()
      // Local maximum forwarding age is conservative; it is not a promise that
      // Clerk will still accept a code. Resends/revocation stay owned by Clerk.
      if (createdAt + 300000 <= clock) return Object.freeze({ status: 'ignored', reason: 'expired' })
      const recipient = mailbox(data.to_email_address)
      const vars = object(data.data)
      let content: Pick<Extract<EmailInstruction,{kind:'new-device-sign-in'}>,'kind'|'signInMethod'|'browserName'|'operatingSystem'|'location'|'ipAddress'|'sessionCreatedAt'|'revokeSessionUrl'>|{kind: 'verification-code'; otpCode: string} | {kind: 'invitation'; actionUrl: string; expiresInDays: number}
      if (data.slug === 'verification_code') {
        if (typeof vars.otp_code !== 'string' || !/^\d{6}$/.test(vars.otp_code)) return reject()
        content = {kind: 'verification-code', otpCode: vars.otp_code}
      } else if(data.slug==='new_device_sign_in'){
        const field=(v:unknown,max=200):string=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f\x7f]|\{\{|\}\}/.test(v))return reject();return v}
        const ipAddress=field(vars.ip_address,45);if(!isIP(ipAddress))return reject()
        // This notification belongs to a signed provider account/address pair.
        if(!optionalId(data.user_id,'user')||!optionalId(data.email_address_id,'idn'))return reject()
        let revokeSessionUrl:string|null=null
        if(vars.revoke_session_url!=null){const raw=field(vars.revoke_session_url,4096),url=new URL(raw)
          if(url.protocol!=='https:'||url.username||url.password||url.hash||/[\x00-\x20\x7f\\]/.test(raw)||!revokeOrigins.includes(url.origin))return reject()
          revokeSessionUrl=raw
        }
        content={kind:'new-device-sign-in',signInMethod:vars.sign_in_method==null?null:field(vars.sign_in_method,100),browserName:field(vars.browser_name,100),operatingSystem:field(vars.operating_system,100),location:field(vars.location),ipAddress,sessionCreatedAt:field(vars.session_created_at),revokeSessionUrl}
      } else {
        const invitation = object(vars.invitation)
        if (typeof vars.action_url !== 'string' || vars.action_url.length > 2000 || /[\x00-\x20\x7f]/.test(vars.action_url)) return reject()
        const url = new URL(vars.action_url), days = invitation.expires_in_days
        if (url.protocol !== 'https:' || url.username || url.password || !origins.includes(url.origin)
          || typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 365) return reject()
        content = {kind: 'invitation', actionUrl: url.href, expiresInDays: days}
      }
      const marker = (vars.user as { public_metadata?: { registrationAttemptId?: unknown } } | undefined)?.public_metadata?.registrationAttemptId
      if (marker !== null && marker !== undefined && (typeof marker !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(marker))) return reject()
      if (data.suppression_reason !== undefined && data.suppression_reason !== null) return reject()
      return Object.freeze({ status: 'ready', instruction: Object.freeze({
        eventId, emailId: id(data.id, 'ema'), instanceId, createdAt, recipient,
        emailAddressId: optionalId(data.email_address_id, 'idn'), providerUserId: optionalId(data.user_id, 'user'),
        ...(typeof marker === 'string' && data.slug === 'verification_code' ? { registrationAttemptId: marker } : {}),
        ...content, expiresAt: createdAt + 300000,
      }) })
    } catch { return reject() }
  }
}
