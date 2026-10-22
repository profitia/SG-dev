import type { RuntimeConfiguration } from './contracts.js'
import { resolveReturnRoute } from './return-routes.js'
import { plPL, enUS } from '@clerk/localizations'

// Official browser SDK/UI, exact public registry versions verified 2026-10-22.
const sdkVersion = '6.40.0', uiVersion = '1.41.1'
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export function accountPage(configuration: RuntimeConfiguration, targetId: string, routeKey: string, flow: string): string {
  const route = resolveReturnRoute(configuration, { targetId, routeKey, flow })
  const en = routeKey.endsWith('-en'), frontend = new URL(configuration.issuer).origin
  const base = configuration.origin + '/account/' + targetId + '/' + routeKey
  const data = JSON.stringify({ returnTo: route.returnTo, en, flow,
    signInUrl: base + '/login', signUpUrl: base + '/registration',
    allowedRedirectOrigins: [...new Set([configuration.origin, ...Object.values(configuration.targets).map(t => t.origin)])],
    localization: en ? enUS : plPL }).replace(/</g, '\\u003c')
  return `<!doctype html><html lang="${en ? 'en' : 'pl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpendGuru — ${en ? 'Your account' : 'Twoje konto'}</title><style>body{margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a}main{max-width:480px;margin:8vh auto;padding:32px;background:white;border:1px solid #e2e8f0;border-radius:20px}h1{font-size:28px}button{padding:12px 20px;border:0;border-radius:24px;background:#d12177;color:white;cursor:pointer}p{line-height:1.6}[hidden]{display:none!important}</style></head><body><main><strong>SpendGuru</strong><h1>${en ? 'One moment for your account' : 'Jeszcze chwila i konto będzie gotowe'}</h1><p id="status" role="status">${en ? 'Checking your session…' : 'Sprawdzamy Twoją sesję…'}</p><div id="sign-in"></div><button id="retry" hidden>${en ? 'Try again' : 'Spróbuj ponownie'}</button> <button id="logout" hidden>${en ? 'Sign out' : 'Wyloguj się'}</button></main><script id="account-config" type="application/json">${data}</script><script defer crossorigin="anonymous" src="${escape(frontend)}/npm/@clerk/ui@${uiVersion}/dist/ui.browser.js"></script><script defer crossorigin="anonymous" data-clerk-publishable-key="${escape(configuration.publishableKey)}" src="${escape(frontend)}/npm/@clerk/clerk-js@${sdkVersion}/dist/clerk.browser.js"></script><script defer src="/account-client"></script></body></html>`
}

/** No passwords/codes, JWT interpretation, persistent storage or permission UI. */
export const accountBrowserScript = String.raw`
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
    if (!session) { status.textContent = cfg.en ? 'Sign in to finish preparing your account.' : 'Zaloguj się, aby dokończyć przygotowanie konta.';
      const options = { routing: 'hash', signInUrl: cfg.signInUrl, signUpUrl: cfg.signUpUrl,
        forceRedirectUrl: window.location.origin + window.location.pathname,
        signInForceRedirectUrl: window.location.origin + window.location.pathname, signUpForceRedirectUrl: window.location.origin + window.location.pathname };
      if (cfg.flow === 'registration') window.Clerk.mountSignUp(signIn, options); else window.Clerk.mountSignIn(signIn, options);
      mounted = true; return; }
    status.textContent = cfg.en ? 'Preparing your account…' : 'Przygotowujemy Twoje konto…';
    try {
      const credential = await session.getToken({ skipCache: true }); if (current !== generation) return; if (!credential) throw Error('SESSION_REQUIRED');
      const response = await fetch('/v1/account', { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + credential }, body: '{}' });
      const result = await response.json();
      if (current !== generation || window.Clerk.session?.id !== key) return;
      if (!response.ok || result.authenticated !== true || typeof result.userId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(result.userId) || !(Date.parse(result.expiresAt) > Date.now())) throw Error('ACCOUNT_UNAVAILABLE');
      status.textContent = cfg.en ? 'Your account is ready.' : 'Konto gotowe.';
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
