import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
const read=name=>fs.readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')
export const workspaceAccessSource=read('005-workspace-access.sql'),workspaceIdentitySource=read('006-workspace-identity-read.sql')
export const workspaceAccessDigest=createHash('sha256').update(workspaceAccessSource).digest('hex')
export const workspaceIdentityDigest=createHash('sha256').update(workspaceIdentitySource).digest('hex')
export const workspaceAccessSql=workspaceAccessSource.replaceAll('__WORKSPACE_ACCESS_SCHEMA_DIGEST__',workspaceAccessDigest)
export const workspaceIdentitySql=workspaceIdentitySource.replaceAll('__WORKSPACE_IDENTITY_SCHEMA_DIGEST__',workspaceIdentityDigest)
export const workspaceEntitlementsSource=read('007-workspace-entitlements.sql')
export const workspaceEntitlementsDigest=createHash('sha256').update(workspaceEntitlementsSource).digest('hex')
export const workspaceEntitlementsSql=workspaceEntitlementsSource.replaceAll('__WORKSPACE_ENTITLEMENTS_SCHEMA_DIGEST__',workspaceEntitlementsDigest)
export function workspaceInstallationPlan(){return {
 status:'PREPARED_NOT_INSTALLED',environment:'development',
 limits:{projectId:'lingering-thunder-05075810',branchId:'br-green-hall-b9s837k0',database:'neondb',owner:'profitia_limits_owner',schemaDigest:workspaceAccessDigest,enabledByDefault:false},
 identity:{projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',database:'platform_private',owner:'profitia_access_owner',schemaDigest:workspaceIdentityDigest},
 entitlements:{schemaDigest:workspaceEntitlementsDigest,enabledByDefault:false,readOnlyConsumer:true,maximumSnapshotLifetimeMs:5000,operatorKeyReused:false},
 effects:{readOnlyConsumer:true,productGrantsCreated:false,packagesCreated:false,assignmentsChanged:false,providerCalls:false,operatorKeyReused:false},
 prerequisites:['Exact accepted source and whole owner CI','Current Development identity and additive rollback review','Existing organisation profile/membership source','Distinct private workspace command/peer keys','Explicit installation/enrolment receipt; never overwrite existing functions'],
 rollback:['Disable new runtime opt-in and restore verified previous exact-SHA deployment','Disable workspace_access_installation; preserve package/assignment and audit history','Retain additive inactive schema for independent review; no destructive rollback'],
 replay:'Existing schema/functions require independent exact digest/definition/role/RLS/privilege readback. Do not re-execute CREATE or alter historical migrations.'
}}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(workspaceInstallationPlan(),null,2))
