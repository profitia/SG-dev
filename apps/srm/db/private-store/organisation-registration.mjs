import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import targets from '../../deployment/private-runtime-targets.json' with {type:'json'}
const url=new URL('./035-organisation-registration.sql',import.meta.url)
export const organisationRegistrationSchemaDigest=()=>createHash('sha256').update(readFileSync(url)).digest('hex')
/** Pure operator plan. Caller owns verified outer transaction and live gates. */
export function organisationRegistrationPlan({binding,sourceSha}){
 const t=targets.environments.development
 if(!binding||binding.environment!=='development'||!(/^[a-f0-9]{40}$/).test(sourceSha??'')
  ||['projectId','branchId','databaseName'].some(k=>binding[k]!==t[k])||binding.role!==t.runtimeRole)throw Error('Explicit accepted SRM Development binding required')
 const digest=organisationRegistrationSchemaDigest()
 return Object.freeze({schemaDigest:digest,sourceSha,sql:Object.freeze([readFileSync(url,'utf8'),
  "INSERT INTO srm.organisation_registration_installation VALUES(true,'"+digest+"')",
  'GRANT EXECUTE ON FUNCTION srm.ensure_registered_organisation(uuid,text,uuid) TO "'+t.runtimeRole+'"'])})
}
/** Only called by the actual current HUMAN Root after its transactional INTENT. */
export async function prepareSrmOrganisationRegistration({context,query}){
 if(context.actorKind!=='HUMAN'||context.applicationId!=='srm'||!context.organisationId)throw Error('Current SRM human organisation required')
 const rows=(await query('SELECT srm.ensure_registered_organisation($1::uuid,$2,$3::uuid) AS ready',
  [context.organisationId,organisationRegistrationSchemaDigest(),context.decisionId])).rows
 if(rows.length!==1||rows[0].ready!==true)throw Error('Registered SRM organisation unavailable')
}
