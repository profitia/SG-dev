import type pg from "pg";
import type { PoolClient } from "pg";
import { createPrivateOperationHost } from "@profitia/platform-contracts/private-operation-host";
import { createClerkIdentityAuthenticator, type ClerkIdentityClient, type IdentityApplication } from "@profitia/platform-contracts/identity-provider";

type HostOptions = Parameters<typeof createPrivateOperationHost<PoolClient>>[0];

/** A late connection cannot escape after the caller's acquisition deadline. */
function acquire(pool: pg.Pool, maxWaitMs: number): Promise<PoolClient> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error("Private transaction acquisition timed out")); }, maxWaitMs);
    pool.connect().then(client => {
      if (settled) { client.release(true); return; }
      settled = true; clearTimeout(timer); resolve(client);
    }, error => {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(error);
    });
  });
}

/** Native pg driver only. Policies, identity resolution, decisions and audit
 * remain in the accepted common mechanism. No live route is activated here. */
export function createSrmPrivateOperationHost(options: Omit<HostOptions, "independentQuery" | "transact" | "createAuthenticator"> & {
  pool: pg.Pool;
  /** Separate native pool with capacity reserved within the login's budget. */
  auditPool: pg.Pool;
  clerk: ClerkIdentityClient;
  identity: IdentityApplication;
}) {
  const { pool, auditPool, clerk, now } = options;
  const identity = structuredClone(options.identity);
  if (!auditPool || pool === auditPool || options.application.appId !== "srm"
    || identity.appId !== options.application.appId || identity.environment !== options.application.environment
    || identity.issuer !== options.application.identityIssuer) throw new TypeError("Explicit consistent SRM host and independent audit pool required");
  return createPrivateOperationHost<PoolClient>({
    application: options.application, binding: options.binding, now,
    transactionTimeoutMs: options.transactionTimeoutMs,
    readResources: options.readResources, projectOutput: options.projectOutput,
    independentQuery: async (sql, values = []) => ({ rows: (await auditPool.query(sql, values)).rows }),
    createAuthenticator: ({ resolveBinding }) => createClerkIdentityAuthenticator({ client: clerk, application: identity, resolveBinding, now }),
    transact: async (work, limits) => {
      const client = await acquire(pool, limits.maxWaitMs);
      let expired = false, released = false, discard = false;
      const release = (destroy: boolean) => { if (!released) { released = true; client.release(destroy); } };
      let timer: ReturnType<typeof setTimeout>;
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          expired = true;
          // Closing this checked-out connection also ends a transaction while
          // its callback awaits non-SQL work. It is never returned for reuse.
          release(true);
          reject(new Error("Private transaction timed out"));
        }, limits.timeoutMs);
      });
      const transaction = (async () => {
        await client.query("BEGIN");
        const result = await work({ transaction: client, query: async (sql, values = []) => ({ rows: (await client.query(sql, values)).rows }) });
        if (expired) throw new Error("Expired private transaction");
        await client.query("COMMIT");
        return result;
      })();
      try { return await Promise.race([transaction, deadline]); }
      catch (error) {
        if (!expired) {
          try { await Promise.race([client.query("ROLLBACK"), deadline]); }
          catch { discard = true; }
        }
        // A connection failure during COMMIT can have an unknown outcome;
        // never replay work automatically or infer rollback from this throw.
        throw error;
      } finally { clearTimeout(timer!); release(expired || discard); }
    },
  });
}
