import type { EmailInstruction } from './email-webhook.js'
import { mailbox } from './mailgun-delivery.js'
import type { RuntimeSdk } from './contracts.js'

/** Verify a signed provider subject against current provider state. Never look
 * up users by email, use unsafe metadata, or select the latest sign-up attempt.
 * Missing subject (including first registration) intentionally stays neutral. */
export function createEmailRecipientVerifier(client: Pick<RuntimeSdk, 'users'>) {
  return async (instruction: EmailInstruction): Promise<'bound' | 'unbound' | 'rejected'> => {
    if (instruction.providerUserId === null) return 'unbound'
    const user = await client.users.getUser(instruction.providerUserId) as {
      id: string; banned?: boolean; locked?: boolean; deprovisioned?: boolean
      emailAddresses?: {id: string; emailAddress: string}[]
    }
    if (user.id !== instruction.providerUserId || user.banned || user.locked || user.deprovisioned
      || !instruction.emailAddressId || !Array.isArray(user.emailAddresses)) return 'rejected'
    return user.emailAddresses.some(e => e.id === instruction.emailAddressId && mailbox(e.emailAddress) === instruction.recipient) ? 'bound' : 'rejected'
  }
}
