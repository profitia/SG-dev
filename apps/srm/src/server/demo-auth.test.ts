import assert from "node:assert/strict";
import test from "node:test";
import { createDemoSession, demoAuthReady, hasDemoSession, passwordMatches, SRM_SESSION_COOKIE, SRM_SESSION_MAX_AGE_SECONDS, verifyDemoSession } from "./demo-auth";

const password = "a-private-test-password";
const sessionSecret = "a-separate-test-session-secret-with-more-than-32-characters";
const now = Date.UTC(2026, 9, 7, 10, 0, 0);

test("demo access fails closed without two independent secrets", () => {
  assert.equal(demoAuthReady({ SRM_DEMO_PASSWORD: password, SRM_DEMO_SESSION_SECRET: sessionSecret }), true);
  assert.equal(demoAuthReady({ SRM_DEMO_PASSWORD: password }), false);
  assert.equal(demoAuthReady({ SRM_DEMO_SESSION_SECRET: sessionSecret }), false);
  assert.equal(demoAuthReady({ SRM_DEMO_PASSWORD: "short", SRM_DEMO_SESSION_SECRET: sessionSecret }), false);
});

test("password comparison accepts only the exact supplied password", async () => {
  assert.equal(await passwordMatches(password, password), true);
  assert.equal(await passwordMatches(`${password} `, password), false);
  assert.equal(await passwordMatches("wrong-password", password), false);
});

test("session is signed, bounded in time, and rejected after tampering or secret rotation", async () => {
  const token = await createDemoSession(sessionSecret, now);
  assert.equal(await verifyDemoSession(sessionSecret, token, now + 1000), true);
  assert.equal(await verifyDemoSession(sessionSecret, token, now + SRM_SESSION_MAX_AGE_SECONDS * 1000), false);
  assert.equal(await verifyDemoSession(sessionSecret, `${token.slice(0, -1)}x`, now + 1000), false);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const final = alphabet.indexOf(token.at(-1)!);
  const equivalentNoncanonical = alphabet[(final & ~3) | ((final + 1) & 3)];
  assert.equal(await verifyDemoSession(sessionSecret, `${token.slice(0, -1)}${equivalentNoncanonical}`, now + 1000), false);
  assert.equal(await verifyDemoSession(`${sessionSecret}rotated`, token, now + 1000), false);
  assert.equal(await verifyDemoSession(sessionSecret, "not-a-session", now + 1000), false);
});

test("API session check rejects missing and invalid cookies", async () => {
  const env = { SRM_DEMO_PASSWORD: password, SRM_DEMO_SESSION_SECRET: sessionSecret };
  assert.equal(await hasDemoSession(new Request("https://example.test/api/xray/search"), env), false);
  assert.equal(await hasDemoSession(new Request("https://example.test/api/xray/search", { headers: { cookie: `${SRM_SESSION_COOKIE}=invalid` } }), env), false);
  const token = await createDemoSession(sessionSecret);
  assert.equal(await hasDemoSession(new Request("https://example.test/api/xray/search", { headers: { cookie: `other=1; ${SRM_SESSION_COOKIE}=${token}` } }), env), true);
});
