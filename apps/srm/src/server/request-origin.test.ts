import assert from "node:assert/strict";
import test from "node:test";
import { isSameOriginRequest, sameOriginRedirectUrl } from "./request-origin";

test("accepts the public HTTPS origin behind Render's proxy", () => {
  const url = "http://0.0.0.0:10000/api/xray/lookup";
  assert.equal(isSameOriginRequest(new Request(url, { method: "POST", headers: {
    host: "srm-development-runtime.onrender.com", origin: "https://srm-development-runtime.onrender.com",
  } })), true);
});

test("rejects requests without a matching browser origin", () => {
  const url = "http://0.0.0.0:10000/api/xray/lookup";
  for (const origin of [undefined, "https://attacker.example", "http://srm-development-runtime.onrender.com"]) {
    assert.equal(isSameOriginRequest(new Request(url, { method: "POST", headers: {
      host: "srm-development-runtime.onrender.com", ...(origin ? { origin } : {}),
    } })), false);
  }
});

test("redirects use the verified public origin, never Render's internal address", () => {
  const url = "http://0.0.0.0:10000/api/auth/login";
  const headers = { host: "srm-development-runtime.onrender.com", origin: "https://srm-development-runtime.onrender.com" };
  assert.equal(sameOriginRedirectUrl(new Request(url, { method: "POST", headers }), "/").href,
    "https://srm-development-runtime.onrender.com/");
  assert.equal(sameOriginRedirectUrl(new Request(url, { method: "POST", headers }), "/login").href,
    "https://srm-development-runtime.onrender.com/login");
  assert.throws(() => sameOriginRedirectUrl(new Request(url, { method: "POST", headers: {
    ...headers, origin: "https://attacker.example",
  } }), "/"), /Untrusted request origin/);
});
