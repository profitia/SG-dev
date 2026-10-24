import type pg from "pg";
import type { PoolClient } from "pg";
import { createSrmNativePgDriver } from "./native-pg-driver";
import { createPrivateOperationHost } from "@profitia/platform-contracts/private-operation-host";
import { createClerkIdentityAuthenticator, type ClerkIdentityClient } from "@profitia/platform-contracts/identity-provider";
import { bindPublicIdentityAuthenticator, type PublicIdentityApplication as IdentityApplication } from "@profitia/platform-contracts/public-request";
import {createAccessStore} from '@profitia/platform-contracts/access-store';
import {OperationDenied} from '@profitia/platform-contracts/operation-context';

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
    application: options.application, binding: options.binding, module: options.module, requestLedger: options.requestLedger, requestContinuation: options.requestContinuation, locationAdmission: options.locationAdmission, now,
    transactionTimeoutMs: options.transactionTimeoutMs,
    ...(options.reportAdmission?{reportAdmission:options.reportAdmission}:{}),
    readResources: options.readResources, projectOutput: options.projectOutput,
    prepareInputs: options.prepareInputs, describeOutcome: options.describeOutcome,
    createAuthenticator: ({ resolveBinding }) => {
      const authenticate = createClerkIdentityAuthenticator({ client: clerk, application: identity, resolveBinding, now });
      return identity.requestBoundary ? bindPublicIdentityAuthenticator(authenticate, identity.requestBoundary) : authenticate;
    },
    ...createSrmNativePgDriver(pool, auditPool),
  });
}

/** ID preparation only: canonical identity and current organisation binding.
 * The ordinary writer host authenticates/locks again and P1 recomputes the ID
 * in its own transaction. This read grants no business permission or effect. */
export async function resolveSrmPrivateIdentity(options:Parameters<typeof createSrmPrivateOperationHost>[0],request:Request,organisationId:string){
 const driver=createSrmNativePgDriver(options.pool,options.auditPool),store=createAccessStore({binding:options.binding,now:options.now});
 let identityBinding:Awaited<ReturnType<typeof store.resolveBinding>>=null,read=false;
 const authenticate=createClerkIdentityAuthenticator({client:options.clerk,application:options.identity,now:options.now,resolveBinding:async key=>{
  if(read)throw new OperationDenied('UNVERIFIED_IDENTITY');read=true;
  identityBinding=await store.resolveBinding(driver.independentQuery,key);return identityBinding;
 }});
 const boundary=options.identity.requestBoundary?bindPublicIdentityAuthenticator(authenticate,options.identity.requestBoundary):authenticate;
 const actor=await boundary(request);
 if(!actor||actor.kind!=='HUMAN'||!read||!identityBinding)throw new OperationDenied('UNVERIFIED_IDENTITY');
 const binding=identityBinding;
 return driver.transact(async({query})=>{
  const lease=await store.lockAccess(query,{actor,identityBinding:binding,organisationId});
  await store.verifyScope(query,lease);
  return Object.freeze({actor,organisationId:lease.organisationId});
 },{timeoutMs:5000,maxWaitMs:3000});
}
