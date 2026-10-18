import type pg from "pg";
import type { PoolClient } from "pg";
import { createSrmNativePgDriver } from "./native-pg-driver";
import { createPrivateOperationHost } from "@profitia/platform-contracts/private-operation-host";
import { createClerkIdentityAuthenticator, type ClerkIdentityClient, type IdentityApplication } from "@profitia/platform-contracts/identity-provider";

type HostOptions = Parameters<typeof createPrivateOperationHost<PoolClient>>[0];

/** Native pg driver only. Policies, identity resolution, decisions and audit
 * remain in the accepted common mechanism. No live route is activated here. */
export function createSrmPrivateOperationHost(options: Omit<HostOptions, "independentQuery" | "transact" | "createAuthenticator" | "module"> & {
  pool: pg.Pool;
  /** Separate native pool with capacity reserved within the login's budget. */
  auditPool: pg.Pool;
  clerk: ClerkIdentityClient;
  identity: IdentityApplication;
  module: { id: 'supplier_report'; schemaDigest: string; auditSchemaDigest: string };
}) {
  const { pool, auditPool, clerk, now } = options;
  const identity = structuredClone(options.identity);
  if (!auditPool || pool === auditPool || !options.module || options.module.id !== 'supplier_report' || options.application.appId !== "srm"
    || identity.appId !== options.application.appId || identity.environment !== options.application.environment
    || identity.issuer !== options.application.identityIssuer) throw new TypeError("Explicit consistent SRM host and independent audit pool required");
  return createPrivateOperationHost<PoolClient>({
    application: options.application, binding: options.binding, module: options.module, requestLedger: options.requestLedger, requestContinuation: options.requestContinuation, now,
    transactionTimeoutMs: options.transactionTimeoutMs,
    readResources: options.readResources, projectOutput: options.projectOutput,
    prepareInputs: options.prepareInputs, describeOutcome: options.describeOutcome,
    createAuthenticator: ({ resolveBinding }) => createClerkIdentityAuthenticator({ client: clerk, application: identity, resolveBinding, now }),
    ...createSrmNativePgDriver(pool, auditPool),
  });
}
