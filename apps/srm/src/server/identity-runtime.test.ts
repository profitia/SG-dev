import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClerkIdentityAuthenticator } from "@profitia/platform-contracts/identity-provider";
import { clerkConfigurationSourceDigest } from "@profitia/platform-contracts/clerk-configuration";
import { ClerkSignIn } from "../../app/login/clerk-sign-in";
import { SrmIdentityProvider, SrmAuthenticatedView, SrmSessionContent, SrmLogout, SrmSessionActions } from "../../app/session-boundary";
import { createSrmClerkClient, IdentityConfigurationUnavailable, readSrmIdentityRuntime } from "./identity-runtime";

const hostname = "identity-fixture.clerk.accounts.dev";
// Deliberately short invalid credentials: sufficient for configuration-prefix
// tests, never usable with an identity provider or mistaken for a real secret.
const secret = "sk_test_fixture";
const development = () => ({ PROFITIA_AUTH_PROVIDER: "clerk", TARGET_ENVIRONMENT: "development",
  PROFITIA_CLERK_ISSUER: `https://${hostname}`,
  PROFITIA_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(hostname + "$").toString("base64url")}`,
  PROFITIA_CLERK_SECRET_KEY: secret,
  PROFITIA_CLERK_AUTHORIZED_PARTIES: JSON.stringify(["http://localhost:3400", "https://srm-development.example.test"]),
});

test("the current deployment remains legacy until explicitly configured; unknown mode fails closed", () => {
  assert.deepEqual(readSrmIdentityRuntime({}), { provider: "legacy_demo" });
  assert.throws(() => readSrmIdentityRuntime({ PROFITIA_AUTH_PROVIDER: "clerkk" }), IdentityConfigurationUnavailable);
});

test("SRM explicitly accepts the one shared configuration implementation and requires the actual target environment", async () => {
  assert.equal(await clerkConfigurationSourceDigest(), 'b3bdad865a16cbf677db1dd7450f594870abca30f8a252bd4d361d2387417246');
  assert.throws(() => readSrmIdentityRuntime({ ...development(), TARGET_ENVIRONMENT: undefined, APP_ENV: 'development' }), IdentityConfigurationUnavailable);
});

test("each missing explicit Clerk input fails closed with a redacted error", () => {
  for (const key of Object.keys(development()).filter(key => key !== "PROFITIA_AUTH_PROVIDER")) {
    const env = { ...development(), [key]: undefined };
    assert.throws(() => readSrmIdentityRuntime(env), error => error instanceof IdentityConfigurationUnavailable &&
      error.message === "Identity configuration unavailable" && !error.stack?.includes(secret));
  }
});

test("public identity configuration contains only its whitelist and cannot be mutated", () => {
  const config = readSrmIdentityRuntime({ ...development(), DATABASE_URL: "not-public" });
  assert.equal(config.provider, "clerk");
  if (config.provider !== "clerk") throw new Error("Expected Clerk");
  assert.deepEqual(Object.keys(config).sort(), ["application", "provider", "publishableKey"]);
  assert.deepEqual(Object.keys(config.application).sort(), ["appId", "authorizedParties", "environment", "issuer"]);
  assert.equal(config.application.appId, "srm");
  assert.equal(JSON.stringify(config).includes(secret), false);
  assert.equal(JSON.stringify(config).includes("not-public"), false);
  assert.throws(() => config.application.authorizedParties.push("https://evil.example.test"), TypeError);
});

test("invalid origins, duplicate origins and mismatched key hosts are rejected", () => {
  for (const origin of ["https://good.example.test/path", "https://*.example.test", "http://remote.example.test", "https://user:password@example.test", "not-an-origin"]) {
    assert.throws(() => readSrmIdentityRuntime({ ...development(), PROFITIA_CLERK_AUTHORIZED_PARTIES: JSON.stringify([origin]) }), IdentityConfigurationUnavailable);
  }
  for (const input of ["not-json", "null", "[]", '["https://one.example.test","https://one.example.test"]']) {
    assert.throws(() => readSrmIdentityRuntime({ ...development(), PROFITIA_CLERK_AUTHORIZED_PARTIES: input }), IdentityConfigurationUnavailable);
  }
  assert.throws(() => readSrmIdentityRuntime({ ...development(), PROFITIA_CLERK_ISSUER: "https://other.clerk.accounts.dev" }), IdentityConfigurationUnavailable);
  assert.throws(() => readSrmIdentityRuntime({ ...development(), PROFITIA_CLERK_SECRET_KEY: "sk_live_fixture" }), IdentityConfigurationUnavailable);
});

test("release environments cannot reuse the Development identity configuration", () => {
  for (const environment of ["staging", "production"]) {
    assert.throws(() => readSrmIdentityRuntime({ ...development(), TARGET_ENVIRONMENT: environment }), IdentityConfigurationUnavailable);
    const live = { ...development(), TARGET_ENVIRONMENT: environment, PROFITIA_CLERK_ISSUER: "https://auth.example.test",
      PROFITIA_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from("auth.example.test$").toString("base64url")}`,
      PROFITIA_CLERK_SECRET_KEY: "sk_live_fixture",
      PROFITIA_CLERK_AUTHORIZED_PARTIES: '["https://srm-staging.example.test"]' };
    assert.equal(readSrmIdentityRuntime(live).provider, "clerk");
  }
});

test("the actual official backend SDK composes with the existing identity adapter", () => {
  const config = readSrmIdentityRuntime(development());
  if (config.provider !== "clerk") throw new Error("Expected Clerk");
  const client = createSrmClerkClient(development());
  assert.equal(typeof client.authenticateRequest, "function");
  assert.equal(typeof client.sessions.getSession, "function");
  assert.equal(typeof client.users.getUser, "function");
  assert.equal(typeof createClerkIdentityAuthenticator({ client, application: config.application, resolveBinding: async () => null }), "function");
  assert.throws(() => createSrmClerkClient({}), IdentityConfigurationUnavailable);
});

test("the actual React provider renders on React19 without a backend secret or a demo form", () => {
  const html = renderToStaticMarkup(createElement(SrmIdentityProvider, { mode: 'clerk', publishableKey: development().PROFITIA_CLERK_PUBLISHABLE_KEY, children: createElement(ClerkSignIn) }));
  assert.equal(html.includes(secret), false);
  assert.equal(html.includes("/api/auth/login"), false);
  assert.equal(html.includes("name=\"password\""), false);
});

test("the actual sign-in component targets the existing root route without creating another provider", () => {
  const element = ClerkSignIn();
  assert.equal(element.props.forceRedirectUrl, "/");
  assert.equal(element.props.withSignUp, false);
  assert.equal(element.props.routing, "hash");
});
test("session presentation withholds report content until a loaded individual session exists", () => {
  const children = createElement("div", null, "private-report-marker");
  for (const session of [{ status: "loading" } as const, { status: "signed-out" } as const,
    { status: "signed-in", userId: "", sessionId: "synthetic-session" } as const]) {
    const html = renderToStaticMarkup(createElement(SrmSessionContent, { session, children }));
    assert(!html.includes("private-report-marker"));
  }
  const html = renderToStaticMarkup(createElement(SrmSessionContent, { session: { status: "signed-in", userId: "synthetic-user", sessionId: "synthetic-session" }, children }));
  assert(html.includes("private-report-marker"));
  assert(!html.includes("synthetic-user")); assert(!html.includes("synthetic-session"));
});
test("changing the individual principal or session replaces the report tree identity", () => {
  const element = (userId: string, sessionId: string) => SrmSessionContent({ session: { status: "signed-in", userId, sessionId }, children: createElement("div") });
  assert.equal(element("user-a", "session-a").key, element("user-a", "session-a").key);
  assert.notEqual(element("user-a", "session-a").key, element("user-b", "session-a").key);
  assert.notEqual(element("user-a", "session-a").key, element("user-a", "session-b").key);
});
test("missing provider, invalid explicit mode and unavailable configuration never reveal a report", () => {
  const report = createElement(SrmAuthenticatedView, { children: createElement("div", null, "private-report-marker") });
  assert(!renderToStaticMarkup(report).includes("private-report-marker"));
  for (const props of [{ mode: "unavailable" } as const, { mode: "clerk" } as const]) {
    assert(!renderToStaticMarkup(createElement(SrmIdentityProvider, { ...props, children: report })).includes("private-report-marker"));
  }
});
test("legacy presentation and logout keep their form while Clerk never uses the demo logout form", () => {
  const children = createElement(SrmLogout, { children: createElement("button", null, "Wyloguj się") });
  const legacy = renderToStaticMarkup(createElement(SrmIdentityProvider, { mode: "legacy_demo", children }));
  assert(legacy.includes('action="/api/auth/logout"')); assert(legacy.includes('method="post"'));
  const named = renderToStaticMarkup(createElement(SrmIdentityProvider, { mode: "clerk", publishableKey: development().PROFITIA_CLERK_PUBLISHABLE_KEY, children }));
  assert(!named.includes('/api/auth/logout')); assert(!named.includes(secret));
});
test("named session controls are available before a report while legacy header visibility is preserved", () => {
  const children = createElement(SrmSessionActions, { legacyVisible: false, children: createElement("span", null, "session-controls-marker") });
  assert(!renderToStaticMarkup(createElement(SrmIdentityProvider, { mode: "legacy_demo", children })).includes("session-controls-marker"));
  assert(renderToStaticMarkup(createElement(SrmIdentityProvider, { mode: "clerk", publishableKey: development().PROFITIA_CLERK_PUBLISHABLE_KEY, children })).includes("session-controls-marker"));
  const hidden = createElement(SrmLogout, { legacyVisible: false, children: createElement("button", null, "logout-marker") });
  assert(!renderToStaticMarkup(createElement(SrmIdentityProvider, { mode: "legacy_demo", children: hidden })).includes("logout-marker"));
});
