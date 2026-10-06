import assert from "node:assert/strict";
import test from "node:test";
import { clearDevelopmentSession, hasDevelopmentAccess, hasDevelopmentSession, isSameOriginRequest, issueDevelopmentSession, verifyDevelopmentCode } from "./development-access";

test("Development code creates a bounded HttpOnly session for same-origin lookup", () => {
  const previousEnvironment = process.env.TARGET_ENVIRONMENT;
  const previousToken = process.env.SRM_DEVELOPMENT_ACCESS_TOKEN;
  process.env.TARGET_ENVIRONMENT = "development";
  process.env.SRM_DEVELOPMENT_ACCESS_TOKEN = "a-long-development-access-code-for-tests";
  try {
    const now = 1_791_260_400_000;
    const url = "https://srm-development-runtime.onrender.com/api/xray/lookup";
    const issued = issueDevelopmentSession(new Request(url), now);
    assert.match(issued, /HttpOnly; SameSite=Strict; Path=\/; Max-Age=43200; Secure/);
    assert.equal(verifyDevelopmentCode("a-long-development-access-code-for-tests"), true);
    assert.equal(verifyDevelopmentCode("wrong"), false);
    const cookie = issued.split(";")[0];
    const request = new Request(url, { method: "POST", headers: { cookie, origin: "https://srm-development-runtime.onrender.com" } });
    assert.equal(hasDevelopmentAccess(request, now + 1000), true);
    assert.equal(hasDevelopmentAccess(request, now + 43_201_000), false);
    assert.equal(hasDevelopmentAccess(new Request(url, { method: "POST", headers: { cookie, origin: "https://attacker.example" } }), now), false);
    assert.equal(hasDevelopmentSession(new Request(url, { headers: { cookie: `${cookie}; ${cookie}` } }), now), false);
    assert.match(clearDevelopmentSession(new Request(url)), /Max-Age=0; Secure/);
  } finally {
    if (previousEnvironment === undefined) delete process.env.TARGET_ENVIRONMENT;
    else process.env.TARGET_ENVIRONMENT = previousEnvironment;
    if (previousToken === undefined) delete process.env.SRM_DEVELOPMENT_ACCESS_TOKEN;
    else process.env.SRM_DEVELOPMENT_ACCESS_TOKEN = previousToken;
  }
});

test("accepts a public HTTPS origin behind Render's internal proxy without admitting another site", () => {
  const url = "http://0.0.0.0:10000/api/development-access";
  assert.equal(isSameOriginRequest(new Request(url, { method: "POST", headers: {
    host: "srm-development-runtime.onrender.com", origin: "https://srm-development-runtime.onrender.com",
  } })), true);
  assert.equal(isSameOriginRequest(new Request(url, { method: "POST", headers: {
    host: "srm-development-runtime.onrender.com", origin: "https://attacker.example",
  } })), false);
  assert.equal(isSameOriginRequest(new Request(url, { method: "POST", headers: {
    host: "srm-development-runtime.onrender.com", origin: "http://srm-development-runtime.onrender.com",
  } })), false);
});
