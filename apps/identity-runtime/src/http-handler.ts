import {conversationThemeClientScript} from './account-visuals.js'
import {organisationInvitationEntryClientScript} from './organisation-onboarding.js'
import {organisationInvitationTokenHash} from '@profitia/platform-contracts/organisation-invitations'
import type { OrganisationHttpSurface } from './organisation-http.js'
import type { OrganisationDraftSurface } from './organisation-draft.js'
import type { RegistrationSurface } from './registration.js'
import type { CommunicationLanguageSurface } from './communication-language.js'
import type { EmailSurface } from './email-runtime.js'
import { BoundaryError, type SessionBoundary } from './contracts.js'
import { checkRequest } from './session-boundary.js'
import type { AccountSurface } from './account-provisioning.js'
import type { AssistantAvatarSurface } from './assistant-avatar.js'
import type { AccountSalutationSurface } from './account-salutation.js'
import { accountPage, accountBrowserScript } from './account-page.js'
import type { CurrentE1Authority } from '@profitia/platform-current-e1-authority'
const headers = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', vary: 'Cookie, Authorization, Origin', 'content-type': 'application/json' }
function json(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers }) }
async function body(request: Request, maximum = 4096): Promise<unknown> {
  const length = request.headers.get('content-length'); if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) throw new BoundaryError(400, 'BODY_LIMIT')
  const reader = request.body?.getReader(); if (!reader) throw new BoundaryError(400, 'JSON_REQUIRED')
  const chunks: Uint8Array[] = []; let total = 0
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maximum) { await reader.cancel(); throw new BoundaryError(400, 'BODY_LIMIT') } chunks.push(value) } }
  finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new BoundaryError(400, 'INVALID_JSON') }
}
/** A missing SDK/authority is an explicit health-only application, never an operational login. */
export function createHttpHandler(boundary: SessionBoundary | null, account: AccountSurface | null = null, avatar: AssistantAvatarSurface | null = null, email: EmailSurface | null = null, language: CommunicationLanguageSurface | null = null, registration: RegistrationSurface | null = null, embedded: ((request: Request) => Promise<Response | null>) | null = null, salutation: AccountSalutationSurface | null = null, currentE1: CurrentE1Authority | null = null, organisationDraft: OrganisationDraftSurface | null = null, organisation: OrganisationHttpSurface | null = null, invitationEntry: Readonly<{targetId:string;routeKey:string}> | null = null) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url)
      if (url.pathname.startsWith('/v1/e1/')) {
        if (url.search || url.hash || !['/v1/e1/ready','/v1/e1/authorize','/v1/e1/source/ready','/v1/e1/source/authorize','/v1/e1/recurring/ready','/v1/e1/recurring/component-ready','/v1/e1/recurring/consent','/v1/e1/recurring/authorize'].includes(url.pathname)) return json(404,{error:'NOT_FOUND'})
        if (!boundary || !currentE1) return json(503,{error:'E1_AUTHORITY_UNAVAILABLE'})
        if (url.origin !== boundary.configuration.origin || url.username || url.password) return json(403,{error:'REQUEST_ORIGIN_REJECTED'})
        if (request.method !== (url.pathname.endsWith('/ready')?'GET':'POST')) return json(405,{error:'METHOD_NOT_ALLOWED'})
        const source=url.pathname.startsWith('/v1/e1/source/'),recurring=url.pathname.startsWith('/v1/e1/recurring/')
        if(recurring&&(!currentE1.recurringComponentReady||!currentE1.recurringReady||!currentE1.recurringConsent||!currentE1.authorizeRecurring))return json(503,{error:'E1_AUTHORITY_UNAVAILABLE'})
        if (source && (!currentE1.sourceReady || !currentE1.authorizeSource)) return json(503,{error:'E1_AUTHORITY_UNAVAILABLE'})
        if (url.pathname.endsWith('/ready')) {const ready=recurring?await currentE1.recurringReady!():source?await currentE1.sourceReady!():await currentE1.ready();return json(ready?200:503,{ready})}
        if (request.headers.has('cookie') || request.headers.has('origin') || request.headers.get('content-type') !== 'application/json') return json(403,{error:'E1_REQUEST_REFUSED'})
        try {const input=await body(request,24576);return json(200,recurring?(url.pathname.endsWith('/component-ready')?await currentE1.recurringComponentReady!(request,input):url.pathname.endsWith('/consent')?await currentE1.recurringConsent!(request,input):await currentE1.authorizeRecurring!(request,input)):source?await currentE1.authorizeSource!(request,input):await currentE1.authorize(request,input))}
        catch (error) {const reason=(error as {reasonCode?:string}).reasonCode;return json(reason==='ACCESS_BASIS_INVALID'||(source||recurring)&&['UNVERIFIED_IDENTITY','IDENTITY_REQUIRED','PERMISSION_DENIED','PRODUCT_UNAVAILABLE','EXPLICIT_DENY'].includes(reason??'')?403:503,{error:'E1_AUTHORITY_REFUSED'})}
      }
      if(url.pathname==='/invite'||url.pathname==='/organisation-invitation-entry'){
        if(!boundary||!account||!organisation?.conversation||!organisation.acceptInvitation||!invitationEntry)return json(503,{error:'ONBOARDING_UNAVAILABLE'});
        if(request.method!=='GET')return json(405,{error:'METHOD_NOT_ALLOWED'});
        if(url.origin!==boundary.configuration.origin||url.username||url.password||url.hash)return json(403,{error:'REQUEST_ORIGIN_REJECTED'});
        if(url.pathname==='/organisation-invitation-entry'){
          if(url.search)return json(404,{error:'NOT_FOUND'});
          return new Response(organisationInvitationEntryClientScript,{headers:{...headers,'content-type':'text/javascript; charset=utf-8'}});
        }
        const keys=[...url.searchParams.keys()];
        // A scanner can inspect the page; this never invokes acceptance or creates a membership.
        // A query-free reload presents recovery text through the same conversation.
        if(url.search){try{if(keys.length!==1||keys[0]!=='proof')throw Error();organisationInvitationTokenHash(url.searchParams.get('proof'));}catch{return json(400,{error:'INVALID_INVITATION_LINK'})}}
        return new Response(accountPage(boundary.configuration,invitationEntry.targetId,invitationEntry.routeKey,'registration',registration!==null,true,true),
          {headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':"frame-ancestors 'none'; base-uri 'none'",'x-frame-options':'DENY'}});
      }
      if(url.pathname==='/v1/account/organisation-onboarding/invitation-accept'){
        if(url.search||url.hash)return json(404,{error:'NOT_FOUND'});
        if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
        if(!boundary||!account||!organisation?.acceptInvitation)return json(503,{error:'ONBOARDING_UNAVAILABLE'});
        checkRequest(request,boundary.configuration,true);
        return json(200,await organisation.acceptInvitation(request,await body(request)));
      }
      const conversationPath='/v1/account/organisation-onboarding/'
      const conversationRoute=url.pathname.startsWith(conversationPath)?url.pathname.slice(conversationPath.length):''
      if (['snapshot','company','slug','categories','invitations','activation','access'].includes(conversationRoute)) {
        if (url.search || url.hash) return json(404, { error: 'NOT_FOUND' })
        const read=conversationRoute==='snapshot'||conversationRoute==='activation'
        if (request.method !== (read?'GET':'POST')) return json(405, { error: 'METHOD_NOT_ALLOWED' })
        const view=organisation?.conversation
        if (!boundary || !account || !organisationDraft || !view) return json(503, { error: 'ONBOARDING_UNAVAILABLE' })
        checkRequest(request,boundary.configuration,!read)
        if (conversationRoute==='snapshot') return json(200,await view.snapshot(request))
        if (conversationRoute==='activation') return json(200,await view.activation(request))
        const input=await body(request,conversationRoute==='invitations'?16384:4096)
        if(conversationRoute==='access'){if(!view.synchroniseAccess)return json(503,{error:'ACCESS_PROJECTION_UNAVAILABLE'});return json(200,await view.synchroniseAccess(request,input))}
        if (conversationRoute==='company') return json(200,await view.lookupCompany(request,input))
        if (conversationRoute==='slug') return json(200,await view.checkSlug(request,input))
        if (conversationRoute==='categories') return json(200,await view.savePersonalCategories(request,input))
        return json(200,await view.sendInvitations(request,input))
      }
      if (url.pathname === '/v1/account/organisation-onboarding/complete') {
        if (url.search || url.hash) return json(404, { error: 'NOT_FOUND' })
        if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })
        if (!boundary || !account || !organisation) return json(503, { error: 'ONBOARDING_UNAVAILABLE' })
        checkRequest(request, boundary.configuration, true)
        return json(200, await organisation.complete(request, await body(request)))
      }
      if (url.pathname === '/v1/account/organisation-onboarding') {
        if (url.search || url.hash) return json(404, { error: 'NOT_FOUND' })
        if (!['GET', 'POST'].includes(request.method)) return json(405, { error: 'METHOD_NOT_ALLOWED' })
        if (!boundary || !account || !organisationDraft) return json(503, { error: 'ONBOARDING_UNAVAILABLE' })
        checkRequest(request, boundary.configuration, request.method === 'POST')
        return json(200, request.method === 'GET' ? await organisationDraft.read(request) : await organisationDraft.update(request, await body(request)))
      }
      if (url.pathname === '/v1/account/salutation') {
        if (url.search || url.hash) return json(404, { error: 'NOT_FOUND' })
        if (request.method !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' })
        if (!boundary || !account || !salutation) return json(503, { error: 'IDENTITY_UNAVAILABLE' })
        return json(200, await salutation.read(request))
      }
      if (url.pathname.startsWith('/v1/embedded/')) return await embedded?.(request) ?? json(404, { error: 'NOT_FOUND' })
      if (url.pathname === '/v1/registration/start' || url.pathname === '/v1/registration/verify') {
        if (url.search || url.hash) return json(404, {error:'NOT_FOUND'})
        if (!registration || !boundary) return json(503, {error:'REGISTRATION_UNAVAILABLE'})
        if (request.method !== 'POST') return json(405, {error:'METHOD_NOT_ALLOWED'})
        checkRequest(request, boundary.configuration, true)
        const input = await body(request)
        return json(200, await (url.pathname.endsWith('/start') ? registration.start(input) : registration.verify(input)))
      }
      if (url.pathname === '/v1/webhooks/clerk-email') {
        if (!email || url.search || url.hash) return json(404, {error:'NOT_FOUND'})
        if (request.method !== 'POST') return json(405, {error:'METHOD_NOT_ALLOWED'})
        return email.handle(request)
      }
      if (url.pathname === '/v1/account/communication-language') {
        if (url.search || url.hash) return json(404, {error:'NOT_FOUND'})
        if (!boundary || !account || !language) return json(503, {error:'IDENTITY_UNAVAILABLE'})
        if (request.method === 'GET') return json(200, await language.read(request))
        if (request.method !== 'POST') return json(405, {error:'METHOD_NOT_ALLOWED'})
        checkRequest(request, boundary.configuration, true)
        return json(200, await language.update(request, await body(request)))
      }
      if (url.pathname === '/v1/account/assistant-avatar') {
        if (url.search || url.hash) return json(404, { error: 'NOT_FOUND' })
        if (!boundary || !account || !avatar) return json(503, { error: 'IDENTITY_UNAVAILABLE' })
        if (request.method === 'GET') return json(200, await avatar.read(request))
        if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })
        checkRequest(request, boundary.configuration, true)
        return json(200, await avatar.update(request, await body(request)))
      }
      if (url.pathname === '/v1/account' || url.pathname === '/account-client' || url.pathname === '/account-theme' || url.pathname.startsWith('/account/')) {
        if (url.hash || ['/v1/account','/account-theme'].includes(url.pathname) && url.search) return json(404, { error: 'NOT_FOUND' })
        if (!boundary || !account) return json(503, { error: 'IDENTITY_UNAVAILABLE' })
        if (url.pathname !== '/v1/account') {
          if (request.method !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' })
          // Public navigation can come from the satellite. Opaque bounded SDK
          // handshake query stays in the browser, never an identity/return input.
          if (url.origin !== boundary.configuration.origin || url.username || url.password || url.search.length > 8192) return json(403, { error: 'REQUEST_ORIGIN_REJECTED' })
          const page = /^\/account\/([a-z0-9-]+)\/([a-z0-9-]+)\/(registration|login|recovery)$/.exec(url.pathname)
          if (!['/account-client','/account-theme'].includes(url.pathname) && !page) return json(404, { error: 'NOT_FOUND' })
          return new Response(page ? accountPage(boundary.configuration, page[1]!, page[2]!, page[3]!, registration !== null, Boolean(organisationDraft && organisation?.conversation)) : url.pathname === '/account-theme' ? conversationThemeClientScript : accountBrowserScript,
            { headers: { ...headers, 'content-type': page ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
              'content-security-policy': "frame-ancestors 'none'; base-uri 'none'", 'x-frame-options': 'DENY' } })
        }
        if (request.method === 'GET') return json(200, await account.read(request))
        if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })
        checkRequest(request, boundary.configuration, true)
        const input = await body(request)
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) return json(400, { error: 'EMPTY_OBJECT_REQUIRED' })
        return json(200, await account.ensure(request))
      }
      if (url.search || url.hash || !['/healthz','/readyz','/v1/session','/v1/flows','/v1/flows/consume','/v1/session/logout'].includes(url.pathname)) return json(404, { error: 'NOT_FOUND' })
      const get = ['/healthz','/readyz','/v1/session'].includes(url.pathname)
      if (request.method !== (get ? 'GET' : 'POST')) return json(405, { error: 'METHOD_NOT_ALLOWED' })
      if (url.pathname === '/healthz') return json(200, { service: 'identity-runtime', status: 'ok' })
      if (url.pathname === '/readyz') { const ready = Boolean(boundary && await boundary.ready() && (!email || await email.ready().then(() => true, () => false)) && (!language || await language.ready().then(() => true, () => false)) && (!registration || await registration.ready().then(() => true, () => false)) && (!organisationDraft || await organisationDraft.ready().then(() => true, () => false)) && (!organisation || await organisation.ready().then(() => true, () => false))); return json(ready ? 200 : 503, { ready }) }
      if (!boundary) return json(503, { error: 'IDENTITY_UNAVAILABLE' })
      checkRequest(request, boundary.configuration, !get)
      if (url.pathname === '/v1/session') { const result = await boundary.session(request); return json(result.status === 'authenticated' ? 200 : result.status === 'unavailable' ? 503 : 401, { authenticated: result.status === 'authenticated' }) }
      if (url.pathname === '/v1/session/logout') { const input = await body(request); if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) return json(400, { error: 'EMPTY_OBJECT_REQUIRED' }); await boundary.logout(request); return json(200, { session: 'revoked' }) }
      if (url.pathname === '/v1/flows') return json(201, await boundary.beginFlow(request, await body(request)))
      const location = await boundary.consumeFlow(request, await body(request)); return new Response(null, { status: 303, headers: { ...headers, location } })
    } catch (error) { return error instanceof BoundaryError ? json(error.status, { error: error.code }) : json(503, { error: 'IDENTITY_UNAVAILABLE' }) }
  }
}
