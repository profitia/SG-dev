import {instrumentDiagnosticPool} from './diagnostic-pg'
import type pg from "pg";
import type { PoolClient } from "pg";
import type { createPrivateOperationHost } from "@profitia/platform-contracts/private-operation-host";
import {measureSupplierStage} from './supplier-telemetry';
type NativeDriver = Pick<Parameters<typeof createPrivateOperationHost<PoolClient>>[0], "independentQuery" | "transact">;

/** Diagnostics never include SQL text, parameters, credentials or error messages.
 * The original result and error still reach the unchanged E1 verifier. */
async function queryNative(target: pg.Pool | PoolClient, sql: string, values: readonly unknown[] = []) {
  const kind = sql === 'SELECT profitia_services.runtime_descriptor() AS descriptor' ? 'SERVICE_DESCRIPTOR'
    : sql.includes('profitia_jobs.lock_job(') ? 'DELEGATED_JOB_LOCK'
    : sql.includes('.append_audit(') ? 'AUDIT_APPEND' : 'NATIVE_SQL';
  try {
    const stage=sql.includes('.scope_allows(')?sql.includes('profitia_jobs.scope_allows')?'E1_JOB_SCOPE'
      :sql.includes('profitia_request_work.scope_allows')?'E1_WORK_SCOPE'
      :sql.includes('profitia_ingestion.scope_allows')?'E1_SOURCE_SCOPE':undefined
      :sql.includes('.append_audit(')?'E1_AUDIT':sql.includes("set_config('statement_timeout'")?'E1_TIMEOUT_SETUP'
      :sql.includes('runtime_descriptor(')?'E1_DESCRIPTOR':undefined;
    const query=()=>target.query(sql,[...values]);
    const result = await measureSupplierStage('E1_SQL',()=>stage?measureSupplierStage(stage,query):query());
    if (kind === 'SERVICE_DESCRIPTOR') {
      const remainingMs = Date.parse(result.rows[0]?.descriptor?.expiresAt) - Date.now();
      if (remainingMs > 30000) console.warn('E1 service proof starts outside local clock window', { remainingMs });
    }
    return { rows: result.rows };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    console.error('Native SQL query failed', { kind, code: typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code) ? code : 'UNAVAILABLE' });
    throw error;
  }
}

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
  instrumentDiagnosticPool(pool);instrumentDiagnosticPool(auditPool,'INDEPENDENT_AUDIT');
  return {
    independentQuery: async (sql, values = []) => queryNative(auditPool, sql, values),
    transact: async (work, limits) => {
      const client = await measureSupplierStage('POOL_WAIT',()=>acquire(pool, limits.maxWaitMs));
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
        const result = await work({ transaction: client, query: async (sql, values = []) => queryNative(client, sql, values) });
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
