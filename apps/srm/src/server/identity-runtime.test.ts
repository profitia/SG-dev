import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClerkIdentityAuthenticator } from "@profitia/platform-contracts/identity-provider";
import { ClerkSignIn } from "../../app/login/clerk-sign-in";
import { createSrmClerkClient, IdentityConfigurationUnavailable, readSrmIdentityRuntime } from "./identity-runtime";

const hostname = "identity-fixture.clerk.accounts.dev";
// Deliberately short invalid credentials: sufficient for configuration-prefix
// tests, never usable with an identity provider or mistaken for a real secret.
const secret = "sk_test_fixture";
const development = () => ({ SRM_AUTH_PROVIDER: "clerk", TARGET_ENVIRONMENT: "development",
  PROFITIA_CLERK_ISSUER: `https://${hostname}`,
  PROFITIA_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(hostname + "$").toString("base64url")}`,
  PROFITIA_CLERK_SECRET_KEY: secret,
  PROFITIA_CLERK_AUTHORIZED_PARTIES: JSON.stringify(["http://localhost:3400", "https://srm-development.example.test"]),
});

test("the current deployment remains legacy until explicitly configured; unknown mode fails closed", () => {
  assert.deepEqual(readSrmIdentityRuntime({}), { provider: "legacy_demo" });
  assert.throws(() => readSrmIdentityRuntime({ SRM_AUTH_PROVIDER: "clerkk" }), IdentityConfigurationUnavailable);
});

test("each missing explicit Clerk input fails closed with a redacted error", () => {
  for (const key of Object.keys(development()).filter(key => key !== "SRM_AUTH_PROVIDER")) {
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
  const html = renderToStaticMarkup(createElement(ClerkSignIn, { publishableKey: development().PROFITIA_CLERK_PUBLISHABLE_KEY }));
  assert.equal(html.includes(secret), false);
  assert.equal(html.includes("/api/auth/login"), false);
  assert.equal(html.includes("name=\"password\""), false);
});
