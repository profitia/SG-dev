import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHandler } from "../dist/server.js";
import { Fault } from "../dist/domain.js";
const actor = { userId: "11111111-1111-4111-8111-111111111111" },
  requestId = "22222222-2222-4222-8222-222222222222";
async function app() {
  let handler,
    calls = 0,
    verifications = 0;
  const server = http.createServer((q, s) => handler(q, s));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  const config = {
    origin,
    issuer: "https://unified-drum-7191.clerk.accounts.dev",
    publishableKey: "synthetic-public-only",
    sourceSha: "a".repeat(40),
  };
  handler = createHandler({
    config,
    health: async () => ({}),
    withIdentity: async (req, action) => {
      verifications++;
      if (
        req.headers.get("authorization") !== "Bearer operator" &&
        req.headers.get("authorization") !== "Bearer ordinary"
      )
        throw new Fault(401, "SIGN_IN_REQUIRED");
      return action({
        actor: {
          ...actor,
          ordinary: req.headers.get("authorization") === "Bearer ordinary",
        },
        organisations: async () => [],
        lockOrganisation: async () => {
          throw new Fault(400, "CANONICAL_ORGANISATION_REQUIRED");
        },
      });
    },
    store: {
      transact: async (a, action) => {
        if (a.ordinary) throw new Fault(403, "OPERATOR_REQUIRED");
        return action({
          call: async () => {
            calls++;
            return {
              packages: [],
              assignments: [],
              metrics: [],
              capabilities: [],
              products: [],
              audit: [],
              metering: "NOT_CONNECTED",
              e1Projection: "PENDING_NOT_CONNECTED",
            };
          },
        });
      },
    },
  });
  return {
    origin,
    get calls() {
      return calls;
    },
    get verifications() {
      return verifications;
    },
    close: () => new Promise((r) => server.close(r)),
  };
}
test("HTTP denies unauthenticated and ordinary users even with forged role/user headers", async () => {
  const a = await app();
  try {
    for (const token of ["", "ordinary"]) {
      const r = await fetch(a.origin + "/api/command", {
        method: "POST",
        headers: {
          Origin: a.origin,
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
          "x-role": "admin",
          "x-user-id": actor.userId,
        },
        body: JSON.stringify({
          operation: "package.create",
          requestId,
          data: { name: "denied", productId: "SPENDGURU" },
        }),
      });
      assert.equal(r.status, token ? 403 : 401);
    }
    assert.equal(a.calls, 0);
  } finally {
    await a.close();
  }
});
test("wrong origin, unsupported method and caller identity fields cannot reach a mutation", async () => {
  const a = await app();
  try {
    const h = {
        Origin: a.origin,
        "Content-Type": "application/json",
        Authorization: "Bearer operator",
      },
      payload = {
        operation: "package.create",
        requestId,
        data: { name: "x", productId: "SPENDGURU" },
      };
    assert.equal(
      (
        await fetch(a.origin + "/api/command", {
          method: "POST",
          headers: { ...h, Origin: "https://evil.example" },
          body: JSON.stringify(payload),
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(a.origin + "/api/command", { headers: h })).status,
      405,
    );
    assert.equal(
      (
        await fetch(a.origin + "/api/command", {
          method: "POST",
          headers: h,
          body: JSON.stringify({ ...payload, userId: actor.userId }),
        })
      ).status,
      400,
    );
    assert.equal(a.calls, 0);
  } finally {
    await a.close();
  }
});
test("valid state uses one identity boundary and one store operation, private/no-store response and honest unknown usage", async () => {
  const a = await app();
  try {
    const r = await fetch(a.origin + "/api/state", {
      headers: { Authorization: "Bearer operator" },
    });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.equal((await r.json()).metering, "NOT_CONNECTED");
    assert.equal(a.verifications, 1);
    assert.equal(a.calls, 1);
  } finally {
    await a.close();
  }
});
