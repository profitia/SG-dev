import { plPL } from "@clerk/localizations";
import type { Config } from "./config.js";
export function page(c: Config): string {
  const data = JSON.stringify({
    publishableKey: c.publishableKey,
    issuer: c.issuer,
    origin: c.origin,
    localization: {
      ...plPL,
      signIn: {
        ...plPL.signIn,
        start: { ...plPL.signIn?.start, subtitle: "Panel operatora Profitii" },
      },
    },
  }).replaceAll("<", "\\u003c");
  return (
    '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Profitia — Pakiety i limity</title><link rel="stylesheet" href="/styles.css"></head><body><div id="app"><main class="welcome"><div class="brand">P<span>Profitia</span></div><h1>Pakiety i limity</h1><p role="status">Przygotowujemy bezpieczne logowanie…</p></main></div><script type="application/json" id="configuration">' +
    data +
    '</script><script defer crossorigin="anonymous" src="' +
    c.issuer +
    '/npm/@clerk/ui@1.41.1/dist/ui.browser.js"></script><script defer crossorigin="anonymous" data-clerk-publishable-key="' +
    c.publishableKey +
    '" src="' +
    c.issuer +
    '/npm/@clerk/clerk-js@6.40.0/dist/clerk.browser.js"></script><script defer type="module" src="/browser.js"></script></body></html>'
  );
}
