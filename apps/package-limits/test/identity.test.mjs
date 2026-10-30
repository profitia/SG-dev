import test from "node:test";
import assert from "node:assert/strict";
import { createClerkIdentityAuthenticator } from "@profitia/platform-contracts/identity-provider";
const issuer = "https://unified-drum-7191.clerk.accounts.dev",
  origin = "https://limits-development.onrender.com",
  id = "11111111-1111-4111-8111-111111111111";
function setup(patch = {}) {
  const calls = { authenticate: 0, session: 0, user: 0, binding: 0 };
  const client = {
    authenticateRequest: async () => {
      calls.authenticate++;
      return {
        status: "signed-in",
        isAuthenticated: true,
        toAuth: () => ({
          isAuthenticated: true,
          tokenType: "session_token",
          userId: "user_fixture",
          sessionId: "sess_fixture",
          actor: null,
          sessionClaims: {
            iss: issuer,
            sub: "user_fixture",
            sid: "sess_fixture",
            azp: origin,
            exp: Math.floor(Date.now() / 1000) + 60,
            ...patch.claims,
          },
        }),
      };
    },
    sessions: {
      getSession: async () => {
        calls.session++;
        return {
          id: "sess_fixture",
          userId: "user_fixture",
          status: "active",
          expireAt: Date.now() + 60000,
          abandonAt: Date.now() + 60000,
          actor: null,
          ...patch.session,
        };
      },
    },
    users: {
      getUser: async () => {
        calls.user++;
        return {
          id: "user_fixture",
          banned: false,
          locked: false,
          deprovisioned: false,
          ...patch.user,
        };
      },
    },
  };
  const authenticate = createClerkIdentityAuthenticator({
    client,
    application: {
      appId: "package-limits-development",
      environment: "development",
      issuer,
      authorizedParties: [origin],
    },
    resolveBinding: async () => {
      calls.binding++;
      return {
        environment: "development",
        issuer,
        subject: "user_fixture",
        userId: id,
        status: "ACTIVE",
        version: "synthetic:1",
        sourceRef: "synthetic-local-only",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        ...patch.binding,
      };
    },
  });
  return { calls, authenticate };
}
const request = (headers = {}) =>
  new Request(origin + "/api/command", {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer synthetic-local-only",
      ...headers,
    },
  });
test("one official SDK verification and one fresh parallel session/account read per operation, canonical User ID passed downstream", async () => {
  const f = setup();
  const actor = await f.authenticate(
    request({ "x-role": "admin", "x-user-id": "forged" }),
  );
  assert.equal(actor.userId, id);
  assert.equal(actor.audience, "package-limits-development");
  assert.deepEqual(f.calls, {
    authenticate: 1,
    session: 1,
    user: 1,
    binding: 1,
  });
  await f.authenticate(request());
  assert.equal(f.calls.user, 2, "new operation must not cache ALLOW");
});
test("wrong origin, azp, issuer, expired token, provider revocation and canonical expiry all deny", async () => {
  for (const patch of [
    { claims: { azp: "https://other.example" } },
    { claims: { iss: "https://other.example" } },
    { claims: { exp: 1 } },
    { session: { status: "revoked" } },
    { user: { banned: true } },
    { binding: { status: "REVOKED" } },
    { binding: { expiresAt: "2000-01-01T00:00:00Z" } },
  ])
    assert.equal(await setup(patch).authenticate(request()), null);
  const f = setup();
  assert.equal(
    await f.authenticate(request({ Origin: "https://evil.example" })),
    null,
  );
  assert.equal(f.calls.authenticate, 0);
});
test("official provider outage fails closed instead of local identity fallback", async () => {
  const f = setup();
  const no = new Proxy(
    {},
    {
      get() {
        throw Error("no provider");
      },
    },
  );
  const verify = createClerkIdentityAuthenticator({
    client: {
      authenticateRequest: async () => {
        throw Error("outage");
      },
      sessions: { getSession: async () => no },
      users: { getUser: async () => no },
    },
    application: {
      appId: "package-limits-development",
      environment: "development",
      issuer,
      authorizedParties: [origin],
    },
    resolveBinding: async () => {
      throw Error("must not resolve");
    },
  });
  await assert.rejects(verify(request()), (e) => e.name === "OperationDenied");
});
