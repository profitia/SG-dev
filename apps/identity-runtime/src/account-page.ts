import type { RuntimeConfiguration } from './contracts.js'
import { resolveReturnRoute } from './return-routes.js'
import { plPL, enUS } from '@clerk/localizations'
import { createClerkConversation, conversationClientScript } from './account-conversation.js'
import { conversationAssets, conversationStyles, conversationMarkup } from './account-visuals.js'

// Official browser SDK/UI, exact public registry versions verified 2026-10-22.
const sdkVersion = '6.40.0', uiVersion = '1.41.1'
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export function accountPage(configuration: RuntimeConfiguration, targetId: string, routeKey: string, flow: string): string {
  const route = resolveReturnRoute(configuration, { targetId, routeKey, flow })
  const en = routeKey.endsWith('-en'), frontend = new URL(configuration.issuer).origin
  const base = configuration.origin + '/account/' + targetId + '/' + routeKey
  const data = JSON.stringify({ returnTo: route.returnTo, en, flow, avatars: conversationAssets,
    signInUrl: base + '/login', signUpUrl: base + '/registration',
    allowedRedirectOrigins: [...new Set([configuration.origin, ...Object.values(configuration.targets).map(t => t.origin)])],
    localization: en ? enUS : plPL }).replace(/</g, '\\u003c')
  return `<!doctype html><html lang="${en ? 'en' : 'pl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpendGuru — ${en ? 'Your account' : 'Twoje konto'}</title><style>${conversationStyles}</style></head><body class="srm-ui sg-v2">${conversationMarkup(en, flow === 'registration', base + '/login', base + '/registration')}<script id="account-config" type="application/json">${data}</script><script defer crossorigin="anonymous" src="${escape(frontend)}/npm/@clerk/ui@${uiVersion}/dist/ui.browser.js"></script><script defer crossorigin="anonymous" data-clerk-publishable-key="${escape(configuration.publishableKey)}" src="${escape(frontend)}/npm/@clerk/clerk-js@${sdkVersion}/dist/clerk.browser.js"></script><script defer src="/account-client"></script></body></html>`
}

/** No passwords/codes, JWT interpretation, persistent storage or permission UI. */
export const accountBrowserScript = 'const createClerkConversation = ' + createClerkConversation.toString() + ';\n' + conversationClientScript + String.raw`
window.addEventListener('load', async () => {
  const cfg = JSON.parse(document.getElementById('account-config').textContent);
  const status = document.getElementById('status'), retry = document.getElementById('retry');
  const logout = document.getElementById('logout'), signIn = document.getElementById('sign-in');
  let active = null, controller, generation = 0, mounted = false, sdkReady = false;
  const unavailable = () => { status.textContent = cfg.en ? 'We could not prepare your account. Please try again.' : 'Nie udało się przygotować konta. Spróbuj ponownie.'; retry.hidden = false; };
  async function complete() {
    const session = window.Clerk.session, key = session?.id || 'signed-out';
    if (key === active) return;
    active = key; const current = ++generation; if (controller) controller.abort();
    controller = new AbortController(); retry.hidden = true; logout.hidden = !session;
    if (mounted) { if (cfg.flow === 'registration') window.Clerk.unmountSignUp(signIn); else window.Clerk.unmountSignIn(signIn); mounted = false; } signIn.replaceChildren();
    if (!session) { status.textContent = cfg.en ? 'Let’s start with a conversation.' : 'Zacznijmy od rozmowy.';
      const options = { routing: 'hash', signInUrl: cfg.signInUrl, signUpUrl: cfg.signUpUrl,
        forceRedirectUrl: window.location.origin + window.location.pathname,
        signInForceRedirectUrl: window.location.origin + window.location.pathname, signUpForceRedirectUrl: window.location.origin + window.location.pathname };
      const nativeChallenge = () => { if (mounted) return; if (cfg.flow === 'registration') window.Clerk.mountSignUp(signIn, options); else window.Clerk.mountSignIn(signIn, options); mounted = true; };
      window.startSpendGuruConversation(cfg, nativeChallenge); return; }
    status.textContent = cfg.en ? 'Preparing your account…' : 'Przygotowujemy Twoje konto…';
    try {
      const credential = await session.getToken({ skipCache: true }); if (current !== generation) return; if (!credential) throw Error('SESSION_REQUIRED');
      const response = await fetch('/v1/account', { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + credential }, body: '{}' });
      const result = await response.json();
      if (current !== generation || window.Clerk.session?.id !== key) return;
      if (!response.ok || result.authenticated !== true || typeof result.userId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(result.userId) || !(Date.parse(result.expiresAt) > Date.now())) throw Error('ACCOUNT_UNAVAILABLE');
      const avatarRequest = async (method, body) => {
        const response = await fetch('/v1/account/assistant-avatar', { method, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + credential }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const value = await response.json();
        if (current !== generation || window.Clerk.session?.id !== key) throw new DOMException('Account changed', 'AbortError');
        if (response.status === 409 && method === 'POST') return null;
        if (response.ok && method === 'GET' && value === null) return null;
        if (!response.ok || !value || value.userId !== result.userId || ![null,'male','female'].includes(value.avatarSex)
          || !/^[1-9][0-9]{0,18}$/.test(value.version)) throw Error('PROFILE_UNAVAILABLE');
        return value;
      };
      let preference = await avatarRequest('GET');
      // A verified user's registration metadata is a bounded presentation hint,
      // never an owner/access claim. A login form's temporary choice is ignored.
      const initialAvatar = window.spendGuruRegistrationAvatar?.(window.Clerk.user?.id) ?? window.Clerk.user?.unsafeMetadata?.assistantAvatar;
      if ((!preference || preference.avatarSex === null) && ['male','female'].includes(initialAvatar)) {
        preference = await avatarRequest('POST', { expectedVersion: preference?.version ?? null, avatarSex: initialAvatar });
        if (!preference) preference = await avatarRequest('GET');
      }
      if (current !== generation || window.Clerk.session?.id !== key) return;
      if (window.spendGuruRestoreAvatar && preference?.avatarSex) window.spendGuruRestoreAvatar(preference.avatarSex);
      if (!(Date.parse(result.expiresAt) > Date.now())) throw Error('ACCOUNT_EXPIRED');
      status.textContent = cfg.en ? 'Your account is ready.' : 'Konto gotowe.';
      if (window.spendGuruAccountReady) await window.spendGuruAccountReady();
      if (current !== generation || window.Clerk.session?.id !== key) return;
      window.location.replace(cfg.returnTo);
    } catch (error) { if (current === generation && error.name !== 'AbortError') unavailable(); }
  }
  retry.onclick = () => { if (!sdkReady) { window.location.reload(); return; } active = null; void complete(); };
  logout.onclick = async () => { ++generation; active = null; controller?.abort(); status.textContent = cfg.en ? 'Signing out…' : 'Wylogowywanie…';
    try { await window.Clerk.signOut(); void complete(); } catch { status.textContent = cfg.en ? 'Sign-out was not confirmed. Please try again.' : 'Wylogowanie nie zostało potwierdzone. Spróbuj ponownie.'; retry.hidden = true; logout.hidden = false; } };
  try { if (!window.Clerk || !window.__internal_ClerkUICtor) throw Error('SDK_UNAVAILABLE');
    await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, signInUrl: cfg.signInUrl, signUpUrl: cfg.signUpUrl,
      allowedRedirectOrigins: cfg.allowedRedirectOrigins, localization: cfg.localization }); sdkReady = true;
    window.Clerk.addListener(() => { void complete(); }); await complete();
  } catch { unavailable(); }
});`
