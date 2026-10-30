import { createHmac } from "node:crypto";
import { Pool } from "pg";
import type { Actor } from "@profitia/platform-contracts/operation-context";
import { Fault, type Dict } from "./domain.js";
export interface Session {
  call(operation: string, data: unknown): Promise<any>;
  summary(): Promise<any>;
}
export function signature(
  key: Uint8Array,
  actor: string,
  until: number,
  tx: string,
  operation: string,
  json: string,
): string {
  return createHmac("sha256", key)
    .update(
      [
        "limits-v1",
        "profitia_limits_runtime",
        actor,
        String(until),
        tx,
        operation,
        json,
      ].join("\u001f"),
    )
    .digest("hex");
}
export class Store {
  constructor(
    readonly pool: Pool,
    readonly key: Buffer,
  ) {}
  async transact<T>(
    actor: Actor,
    action: (session: Session) => Promise<T>,
  ): Promise<T> {
    const c = await this.pool.connect();
    let committed = false;
    try {
      await c.query(
        "BEGIN; SET LOCAL statement_timeout='5000ms'; SET LOCAL lock_timeout='2000ms'; SET LOCAL idle_in_transaction_session_timeout='10000ms'",
      );
      const tx = (await c.query("SELECT pg_current_xact_id()::text AS tx"))
        .rows[0].tx as string;
      const until = Math.min(Date.parse(actor.expiresAt), Date.now() + 5000);
      const session: Session = {
        summary: async () =>
          (
            await c.query(
              "SELECT profitia_limits.dashboard($1::uuid,$2::bigint,$3,$4,$5) AS data",
              [
                actor.userId,
                until,
                tx,
                "{}",
                signature(
                  this.key,
                  actor.userId!,
                  until,
                  tx,
                  "authorize",
                  "{}",
                ),
              ],
            )
          ).rows[0].data,
        call: async (operation, data) => {
          const json = JSON.stringify(data);
          return (
            await c.query(
              "SELECT profitia_limits.api($1::uuid,$2::bigint,$3,$4,$5,$6) AS data",
              [
                actor.userId,
                until,
                tx,
                operation,
                json,
                signature(this.key, actor.userId!, until, tx, operation, json),
              ],
            )
          ).rows[0].data;
        },
      };
      const result = await action(session);
      if (Date.now() >= until) throw new Fault(403, "AUTHORITY_EXPIRED");
      await c.query("COMMIT");
      committed = true;
      return result;
    } catch (e) {
      const error = e as { code?: string; message?: string };
      if (e instanceof Fault) throw e;
      if (error.code === "42501") throw new Fault(403, "OPERATOR_REQUIRED");
      if (
        error.code === "23505" ||
        error.code === "40001" ||
        error.code === "55P03"
      )
        throw new Fault(
          409,
          error.message?.includes("OVERLAP")
            ? "ASSIGNMENT_OVERLAP"
            : "CONCURRENT_OR_DUPLICATE_CHANGE",
        );
      if (
        ["23514", "23503", "22P02", "22007", "22008"].includes(error.code ?? "")
      )
        throw new Fault(
          400,
          error.message?.match(/^[A-Z_]+$/)?.[0] ?? "INVALID_BUSINESS_INPUT",
        );
      const failure = new Fault(503, "WRITE_OR_READ_NOT_CONFIRMED");
      failure.cause = e;
      throw failure;
    } finally {
      if (!committed) {
        try {
          await c.query("ROLLBACK");
        } catch {}
      }
      c.release();
    }
  }
  async health() {
    return (
      await this.pool.query(
        "SELECT profitia_limits.health() || jsonb_build_object('dashboardDigest',profitia_limits.dashboard_health()) AS data",
      )
    ).rows[0].data;
  }
}
