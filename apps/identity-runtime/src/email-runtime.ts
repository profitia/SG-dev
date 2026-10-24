import type { CommunicationLanguage } from './communication-language.js'
import { createHash } from 'node:crypto'
import type { EmailInstruction, EmailEventDecision } from './email-webhook.js'
import { EmailEventRejected } from './email-webhook.js'
import type { EmailStore, EmailClaim } from './email-store.js'
import type { AssistantAvatar } from './email-avatar.js'
import type { EmailContent, InlineImage, Submission } from './mailgun-delivery.js'
import type {Salutation} from './vocative.js'

export interface EmailSurface { ready(): Promise<void>; handle(request: Request): Promise<Response>; stop(): Promise<void>; tick(): Promise<void> }
type Asset = { filename: string; url: string; sha256: string }
type Renderer = {
  inlineAssetsForAvatar(avatar: AssistantAvatar): Asset[]
  renderMailgunResolved(options: {kind: string; avatar: AssistantAvatar; language:CommunicationLanguage; data: Record<string, unknown>; allowedActionOrigins: readonly string[]}): EmailContent
}
export function verifyEmailAsset(bytes: Uint8Array, asset: Asset): InlineImage {
  if (bytes.length > 2000000 || !Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw Error('EMAIL_ASSET_REJECTED')
  return {filename: asset.filename, bytes}
}
/** Fixed canonical public assets, pinned digests; no arbitrary request URLs. */
export async function loadEmailRenderer(appName: string, origins: readonly string[], fetcher: typeof fetch = fetch) {
  if (!appName || appName.length > 80 || /[\x00-\x1f\x7f{}]/.test(appName)) throw Error('EMAIL_APP_NAME')
  const moduleUrl = new URL('../../email-templates/render.mjs', import.meta.url).href
  const renderer = await import(moduleUrl) as Renderer, images = new Map<string, InlineImage>()
  for (const avatar of ['male','female','neutral'] as const) for (const asset of renderer.inlineAssetsForAvatar(avatar)) {
    if (images.has(asset.filename)) continue
    const url = new URL(asset.url)
    if (url.origin !== 'https://storage.googleapis.com' || !url.pathname.startsWith('/storage.magicpath.ai/component-assets/')) throw Error('EMAIL_ASSET_ORIGIN')
    const response = await fetcher(url, {redirect:'error', signal:AbortSignal.timeout(10000)})
    if (!response.ok || !response.body) { await response.body?.cancel(); throw Error('EMAIL_ASSET_UNAVAILABLE') }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
    try { for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength
      if (size > 2000000) { await reader.cancel(); throw Error('EMAIL_ASSET_LIMIT') } chunks.push(chunk.value) } }
    finally { reader.releaseLock() }
    images.set(asset.filename, verifyEmailAsset(Buffer.concat(chunks), asset))
  }
  return async (instruction: EmailInstruction, avatar: AssistantAvatar, language:CommunicationLanguage, salutation:Salutation = {}): Promise<EmailContent> => {
    const content = renderer.renderMailgunResolved({kind:instruction.kind, avatar, language, allowedActionOrigins:origins, data:{appName,
      currentYear:new Date(instruction.createdAt).getUTCFullYear(), requestedFrom:appName, requestedAt:new Date(instruction.createdAt).toISOString(),...salutation,
      ...(instruction.kind === 'verification-code' ? {otpCode:instruction.otpCode} : {actionUrl:instruction.actionUrl,expiresInDays:instruction.expiresInDays})}})
    const inline = renderer.inlineAssetsForAvatar(avatar).map(asset => { content.html = content.html.replaceAll(asset.url, 'cid:'+asset.filename); return images.get(asset.filename)! })
    return {...content, inline}
  }
}

/** At-least-once intake, at-most-one automatic provider attempt per email ID.
 * A crash after begin is unknown, not retryable. Provider acceptance is not inbox
 * delivery. No code, link, recipient, body or raw exception enters diagnostics. */
export function createEmailRuntime(options: {
  verify(request: Request): Promise<EmailEventDecision>; store: EmailStore
  recipient(instruction: EmailInstruction): Promise<'bound'|'unbound'|'rejected'>
  render(instruction: EmailInstruction, avatar: AssistantAvatar, language:CommunicationLanguage, salutation?:Salutation): Promise<EmailContent>
  send(message: EmailContent & {recipient: string}): Promise<Submission>
  diagnostic?(code: 'intake-unavailable'|'worker-unavailable'|'submission-unknown'): void
  now?: () => number; pollMs?: number; autoStart?: boolean
}): EmailSurface {
  const now = options.now ?? Date.now, poll = options.pollMs ?? 2000
  if (!Number.isInteger(poll) || poll < 100 || poll > 60000) throw Error('EMAIL_POLL_INTERVAL')
  let stopped = false, running: Promise<void> | null = null
  const reply = (status: number) => new Response(null, {status, headers:{'cache-control':'no-store'}})
  const processOne = async () => {
    let claim: EmailClaim | null = null, started = false
    try {
      claim = await options.store.claim(); if (!claim) return
      if (stopped) { await options.store.release(claim); return }
      if (claim.instruction.expiresAt <= now()) { await options.store.settle(claim,'rejected'); return }
      let recipient: 'bound'|'unbound'|'rejected'
      try { recipient = await options.recipient(claim.instruction) }
      catch { await options.store.release(claim); return }
      if (stopped) { await options.store.release(claim); return }
      if (recipient === 'rejected') { await options.store.settle(claim,'rejected'); return }
      const preference = await options.store.begin(claim); started = true
      let message: EmailContent
      try { message = await options.render(claim.instruction, recipient === 'bound' ? preference.avatar : 'neutral', recipient === 'bound' ? preference.language : 'en', recipient === 'bound' ? {firstName:preference.firstName??null,vocative:preference.vocative??null} : {}) }
      catch { await options.store.settle(claim,'rejected'); return }
      // Once begin is durable, finish this attempt during graceful shutdown.
      // Releasing it would risk a duplicate; rejecting it would discard a valid code.
      if (claim.instruction.expiresAt <= now()) { await options.store.settle(claim,'rejected'); return }
      // Every throw after entering send is uncertain, including transport timeouts.
      const result = await options.send({...message, recipient:claim.instruction.recipient})
      await options.store.settle(claim, result.status, result.status === 'accepted' ? result.providerId : undefined)
      if (result.status === 'unknown') options.diagnostic?.('submission-unknown')
    } catch {
      if (claim && started) { try { await options.store.settle(claim,'unknown') } catch { /* durable sweep resolves abandoned sending state */ } }
      options.diagnostic?.('worker-unavailable')
    }
  }
  const tick = async () => {
    if (stopped) return
    if (!running) running = processOne().finally(() => { running = null })
    await running
  }
  const timer = options.autoStart === false ? null : setInterval(() => { void tick() },poll)
  timer?.unref()
  return {
    tick, ready: () => options.store.ready(),
    async stop() { stopped=true; if (timer) clearInterval(timer); await running },
    async handle(request) {
      if (stopped) return reply(503)
      let decision: EmailEventDecision
      try { decision = await options.verify(request) } catch (error) { return reply(error instanceof EmailEventRejected ? 400 : 503) }
      if (stopped) return reply(503)
      if (decision.status === 'ignored') return reply(204)
      try { await options.store.enqueue(decision.instruction); return reply(204) }
      catch { options.diagnostic?.('intake-unavailable'); return reply(503) }
    },
  }
}
