import { createClerkClient } from "@clerk/backend";
import {
  createClerkIdentityAuthenticator,
  type ClerkIdentityClient,
} from "@profitia/platform-contracts/identity-provider";
import type { Actor } from "@profitia/platform-contracts/operation-context";
import { Pool, type PoolClient } from "pg";
import type { Config } from "./config.js";
import { Fault } from "./domain.js";
export interface IdentityScope {
  actor: Actor;
  organisations(
    search: string,
    ids: string[] | null,
  ): Promise<Record<string, unknown>[]>;
  lockOrganisation(
    id: string,
  ): Promise<{ organisation_id: string; version: string | number }>;
}
export type WithIdentity = <T>(
  request: Request,
  action: (scope: IdentityScope) => Promise<T>,
) => Promise<T>;
export function identityBoundary(
  config: Config,
  pool: Pool,
  client: ClerkIdentityClient = createClerkClient({
    secretKey: config.secretKey,
    publishableKey: config.publishableKey,
  }),
): WithIdentity {
  return async (request, action) => {
    let sql: PoolClient | undefined;
    let oldestObservation = Number.POSITIVE_INFINITY;
    const observedClient: ClerkIdentityClient = {
      authenticateRequest: (...args) => client.authenticateRequest(...args),
      sessions: {
        getSession: async (id) => {
          const result = await client.sessions.getSession(id);
          oldestObservation = Math.min(oldestObservation, Date.now());
          return result;
        },
      },
      users: {
        getUser: async (id) => {
          const result = await client.users.getUser(id);
          oldestObservation = Math.min(oldestObservation, Date.now());
          return result;
        },
      },
    };
    const authenticate = createClerkIdentityAuthenticator({
      client: observedClient,
      application: {
        appId: "package-limits-development",
        environment: "development",
        issuer: config.issuer,
        authorizedParties: [config.origin],
      },
      resolveBinding: async (key) => {
        sql = await pool.connect();
        await sql.query(
          "BEGIN; SET LOCAL statement_timeout='5000ms'; SET LOCAL lock_timeout='2000ms'; SET LOCAL idle_in_transaction_session_timeout='10000ms'",
        );
        return (
          (
            await sql.query(
              "SELECT profitia_limits_identity_read.binding($1,$2) AS binding",
              [key.issuer, key.subject],
            )
          ).rows[0]?.binding ?? null
        );
      },
    });
    try {
      const actor = await authenticate(request);
      if (!actor || !sql) throw new Fault(401, "SIGN_IN_REQUIRED");
      const until = Math.min(
        Date.parse(actor.expiresAt),
        oldestObservation + 5000,
      );
      if (!Number.isFinite(until) || until <= Date.now())
        throw new Fault(503, "IDENTITY_UNAVAILABLE");
      const boundedActor = Object.freeze({
        ...actor,
        expiresAt: new Date(until).toISOString(),
      });
      const connection = sql;
      const scope: IdentityScope = {
        actor: boundedActor,
        organisations: async (search, ids) =>
          (
            await connection.query(
              "SELECT profitia_limits_identity_read.organisations($1,$2::uuid[]) AS data",
              [search, ids],
            )
          ).rows[0].data,
        lockOrganisation: async (id) =>
          (
            await connection.query(
              "SELECT profitia_limits_identity_read.lock_organisation($1::uuid) AS data",
              [id],
            )
          ).rows[0].data,
      };
      return await action(scope);
    } catch (e) {
      if (e instanceof Fault) throw e;
      if ((e as Error)?.name === "OperationDenied")
        throw new Fault(503, "IDENTITY_UNAVAILABLE");
      throw e;
    } finally {
      if (sql) {
        try {
          await sql.query("ROLLBACK");
        } catch {}
        sql.release();
      }
    }
  };
}
