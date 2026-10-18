import type pg from "pg";
import type { PoolClient } from "pg";
import type { createPrivateOperationHost } from "@profitia/platform-contracts/private-operation-host";
type NativeDriver = Pick<Parameters<typeof createPrivateOperationHost<PoolClient>>[0], "independentQuery" | "transact">;

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

/** One native pg transaction driver for existing HUMAN and SOURCE hosts.
 * No identity, permission, domain policy or audit implementation lives here. */
export function createSrmNativePgDriver(pool: pg.Pool, auditPool: pg.Pool): NativeDriver {
  if (!pool || !auditPool || pool === auditPool) throw new TypeError("Distinct native transaction and independent audit pools required");
  return {
    independentQuery: async (sql, values = []) => ({ rows: (await auditPool.query(sql, values)).rows }),
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
  };
}
