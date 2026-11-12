import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
const base=new URL('../../../packages/platform-contracts/migrations/profile/',import.meta.url)
export const organisationInstallationSources=Object.freeze(Object.fromEntries(['007-organisation-onboarding.sql','008-organisation-create.sql','009-organisation-lifecycle.sql','010-organisation-access-projection.sql','011-application-organisation-context.sql'].map(name=>{
 const sql=fs.readFileSync(new URL(name,base),'utf8');return [name,Object.freeze({sha256:createHash('sha256').update(sql).digest('hex'),sql})]
})))
const native=[
 'organisation_onboarding_descriptor()','organisation_onboarding_read()','organisation_onboarding_save(bigint,jsonb)',
 'organisation_bootstrap_descriptor()','organisation_bootstrap_lock()','organisation_bootstrap_state(uuid,bigint,bigint,text)','organisation_bootstrap_create(text,bigint,text,uuid)',
 'organisation_lifecycle_descriptor()','organisation_lifecycle_lock()','organisation_lifecycle_context(bigint,text)','organisation_lifecycle_admit(text,text,text,uuid,bigint,text)',
 'organisation_lifecycle_slug(text,uuid)','organisation_lifecycle_company(text,uuid)','organisation_lifecycle_categories(bigint,jsonb,uuid)',
 'organisation_lifecycle_enqueue(text,bigint,text,uuid)','organisation_lifecycle_accept(text,bigint,text,uuid)',
 'organisation_lifecycle_delivery_claim(uuid,text)','organisation_lifecycle_delivery_begin(uuid,uuid,text,text,bigint,text)','organisation_lifecycle_delivery_settle(uuid,uuid,text,text,text)',
 'organisation_lifecycle_snapshot(uuid)','organisation_lifecycle_stored_company(text)','organisation_lifecycle_recipient_salutations(text[],uuid)',
 'organisation_lifecycle_lookup_draft(uuid)','organisation_lifecycle_company_store(text,bigint,text,uuid)','organisation_lifecycle_invitation_replay(uuid,uuid)',
 'organisation_access_descriptor()','organisation_lifecycle_access_project(text,bigint,text,uuid)'
]
const registry=[
 'organisation_lifecycle_descriptor()','organisation_lifecycle_context(bigint,text)','organisation_lifecycle_admit(text,text,text,uuid,bigint,text)',
 'organisation_lifecycle_lookup_draft(uuid)','organisation_lifecycle_company_envelope(text,uuid)','organisation_lifecycle_company_store(text,bigint,text,uuid)'
]
export function organisationRuntimeFunctionGrants(role,purpose){
 if(!/^[a-z][a-z0-9_]{0,62}$/.test(role??'')||!['IDENTITY','REGISTRY'].includes(purpose))throw Error('EXACT_ORDINARY_PURPOSE_REQUIRED')
 return (purpose==='IDENTITY'?native:registry).map(f=>'GRANT EXECUTE ON FUNCTION profitia_profile.'+f+' TO '+role+';').join('\n')
}
export function organisationInstallationPlan(){return {
 status:'PREPARED_NOT_INSTALLED',targetEnvironment:'development',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',owner:'profitia_access_owner',
 migrations:Object.entries(organisationInstallationSources).map(([path,value])=>({path,sha256:value.sha256})),
 sourceOnly:true,sqlExecuted:false,
 organisationContext:{defaultEnabled:false,sql:'011-application-organisation-context.sql',operation:'account.settings.read',root:'1.0.0-candidate.16',functions:['organisation_context_descriptor()','read_current_organisation_context(uuid)'],enrolmentSeparate:true,noBusinessGrant:true},
 accessProjection:{defaultEnabled:false,sql:'010-organisation-access-projection.sql',maximumLeaseSeconds:28,renewalRequired:true,ownerAndMemberPermission:'organisation.access.synchronise',noImplicitRoleAuthority:true,preserveIndependentGrants:true},
 before:['Verify current canonical Development installation, exact accepted source and ordinary role bindings','Capture LKG deployments/configuration and exact existing schema/definition/RLS/privilege receipts without secrets','Stop if an existing candidate schema differs; no overwrite or DROP','Install missing additive schemas transactionally as NOLOGIN owner, with policies initially disabled','Enrol Identity lifecycle and bootstrap policies with explicit platform permissions and current licence reference','Enrol separate registry-only role/application/profile policy and six native functions; no account registration or invitations for that role','Enrol separate MGBI onboarding Source/native path/budget/licence; do not inherit the KRS pilot exception','Configure distinct private peer/profile keys only in existing services','Verify exact definitions, digests, modes, owners, RLS, ordinary grants, keys by fingerprints and current descriptors before enablement'],
 permissionBoundary:{roleLabelsAreAuthority:false,operatorGrantCreated:false,unlimitedPackageCreated:false,sourceCredentialCopied:false,rawPrivateArchivesRead:false},
 unresolvedBeforeBusinessGo:['Current manual package assignment and matching governed E1 projection','Current module membership permissions for the accepted applications','Real provider/mail/Clerk browser and tenant-isolation acceptance'],
 rollback:['Disable new opt-ins and preserve account login','Restore exact verified LKG app releases/configuration','Disable new purpose policies and retain organisation/member/category/invitation/history data','Do not delete schemas, identities, memberships, packages or other commercial grant bases'],
 replay:'Existing installation requires independent exact definitions and source receipt verification; never re-run CREATE or rotate existing keys automatically.'
}}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(organisationInstallationPlan(),null,2))
