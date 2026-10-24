import { languageSchemaDigest, type CommunicationLanguage } from './communication-language.js'
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { EmailInstruction } from './email-webhook.js'
import type { AssistantAvatar } from './email-avatar.js'

export const emailSchemaDigest = () => createHash('sha256').update(readFileSync(new URL('../migrations/profile/003-email-delivery.sql', import.meta.resolve('@profitia/platform-contracts/user-profile')))).digest('hex')
export type EmailClaim = { emailId: string; token: string; instruction: EmailInstruction }
export interface EmailStore {
  ready(): Promise<void>
  enqueue(instruction: EmailInstruction): Promise<'queued' | 'duplicate'>
  claim(): Promise<EmailClaim | null>
  begin(claim: EmailClaim): Promise<{avatar:AssistantAvatar; language:CommunicationLanguage}>
  release(claim: EmailClaim): Promise<void>
  settle(claim: EmailClaim, status: 'accepted' | 'rejected' | 'unknown', providerId?: string): Promise<void>
}
type Query = (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
type Transact = <T>(run: (tx: { query: Query }) => Promise<T>) => Promise<T>
export type EmailStoreConfig = {
  binding: { applicationId: string; environment: string; role: string; projectId: string; branchId: string; databaseName: string; schemaDigest: string }
  issuer: string; instanceId: string; serviceId: string; schemaDigest: string; proofKey: Uint8Array; encryptionKey: Uint8Array; keyId: string
}
/** Persistent PostgreSQL service boundary; no raw table rights or profile writes. */
export function createEmailStore(config: EmailStoreConfig, transact: Transact, now = Date.now): EmailStore {
  const c = structuredClone(config), proof = Buffer.from(c.proofKey), encryption = Buffer.from(c.encryptionKey)
  if (c.binding.environment !== 'development' || c.schemaDigest !== emailSchemaDigest() || proof.length !== 32 || encryption.length !== 32
    || proof.equals(encryption) || !/^[a-z0-9-]{1,64}$/.test(c.keyId) || !/^ins_[A-Za-z0-9]{4,120}$/.test(c.instanceId)
    || !/^[a-z0-9-]{3,100}$/.test(c.serviceId)) throw Error('EMAIL_STORE_CONFIGURATION')
  const descriptor = async (query: Query) => {
    const d = (await query('SELECT profitia_profile.email_descriptor() AS d')).rows[0]?.d as Record<string, unknown> | undefined
    const language = (await query('SELECT profitia_profile.language_descriptor() AS d')).rows[0]?.d as Record<string,unknown> | undefined
    if (!language || language.languageSchemaDigest !== languageSchemaDigest()) throw Error('EMAIL_LANGUAGE_UNAVAILABLE')
    if (!d || d.enabled !== true || d.emailSchemaDigest !== c.schemaDigest || d.issuer !== c.issuer || d.instanceId !== c.instanceId || d.serviceId !== c.serviceId
      || Object.entries(c.binding).some(([key, value]) => d[key] !== value)) throw Error('EMAIL_STORE_UNAVAILABLE')
  }
  const command = async (value: Record<string, unknown>): Promise<Record<string, unknown>> => transact(async ({ query }) => {
    await descriptor(query)
    const tx = (await query('SELECT txid_current()::text AS tx')).rows[0]?.tx
    if (typeof tx !== 'string' || !/^[1-9]\d*$/.test(tx)) throw Error('EMAIL_STORE_UNAVAILABLE')
    const until = now() + 4500, body = JSON.stringify(value)
    const signature = createHmac('sha256', proof).update([c.binding.environment, c.binding.applicationId, c.binding.role, c.serviceId, c.instanceId, tx, until, body].join('\x1f')).digest('hex')
    const result = (await query('SELECT profitia_profile.email_command($1,$2,$3) AS result', [body, until, signature])).rows[0]?.result
    if (!result || typeof result !== 'object') throw Error('EMAIL_STORE_UNAVAILABLE')
    return result as Record<string, unknown>
  }).catch(() => { throw Error('EMAIL_STORE_UNAVAILABLE') })
  const aad = (emailId: string) => Buffer.from([c.binding.environment, c.binding.applicationId, c.instanceId, emailId, c.keyId].join('\x1f'))
  return Object.freeze({
    ready: () => transact(async ({ query }) => { await descriptor(query) }),
    async enqueue(instruction: EmailInstruction) {
      if (instruction.instanceId !== c.instanceId || instruction.expiresAt <= now()) throw Error('EMAIL_INSTRUCTION_REJECTED')
      const { eventId, ...stable } = instruction
      const plaintext = JSON.stringify(stable), nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryption, nonce)
      cipher.setAAD(aad(instruction.emailId))
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(instruction), 'utf8'), cipher.final()])
      const ciphertext = [c.keyId, nonce.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
      const result = await command({ op: 'enqueue', emailId: instruction.emailId, eventId, providerSubject: instruction.providerUserId,
        ...(instruction.registrationAttemptId ? {registrationAttemptId:instruction.registrationAttemptId,emailAddressId:instruction.emailAddressId} : {}),
        fingerprint: createHmac('sha256', encryption).update(plaintext).digest('hex'), ciphertext, expiresAt: instruction.expiresAt })
      if (result.status !== 'queued' && result.status !== 'duplicate') throw Error('EMAIL_STORE_UNAVAILABLE')
      return result.status
    },
    async claim() {
      const r = await command({ op: 'claim' }); if (r.status === 'empty') return null
      if (r.status !== 'leased' || typeof r.emailId !== 'string' || typeof r.token !== 'string' || typeof r.ciphertext !== 'string') throw Error('EMAIL_STORE_UNAVAILABLE')
      try {
        const [keyId, nonce, tag, ciphertext, extra] = r.ciphertext.split('.')
        if (keyId !== c.keyId || !nonce || !tag || !ciphertext || extra !== undefined) throw Error()
        const decipher = createDecipheriv('aes-256-gcm', encryption, Buffer.from(nonce, 'base64url'))
        decipher.setAAD(aad(r.emailId)); decipher.setAuthTag(Buffer.from(tag, 'base64url'))
        const instruction = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')) as EmailInstruction
        if (instruction.emailId !== r.emailId || instruction.instanceId !== c.instanceId) throw Error()
        return { emailId: r.emailId, token: r.token, instruction }
      } catch {
        await command({ op: 'settle', emailId: r.emailId, token: r.token, status: 'rejected', providerId: null })
        throw Error('EMAIL_PAYLOAD_UNAVAILABLE')
      }
    },
    async begin(claim: EmailClaim) {
      const r = await command({ op: 'begin', emailId: claim.emailId, token: claim.token })
      if (r.status !== 'sending' || !['male','female','neutral'].includes(String(r.avatar)) || !['pl','en'].includes(String(r.language))) throw Error('EMAIL_STORE_UNAVAILABLE')
      return {avatar:r.avatar as AssistantAvatar,language:r.language as CommunicationLanguage}
    },
    async release(claim: EmailClaim) { await command({ op: 'release', emailId: claim.emailId, token: claim.token }) },
    async settle(claim: EmailClaim, status: 'accepted' | 'rejected' | 'unknown', providerId?: string) { await command({ op: 'settle', emailId: claim.emailId, token: claim.token, status, providerId: providerId ?? null }) },
  })
}
