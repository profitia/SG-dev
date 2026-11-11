import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createAccessStore} from './access-store.mjs'
import {createClerkIdentityAuthenticator} from './identity-provider.mjs'
import {createProfileSql,ProfileConflict} from './identity-profile-sql.mjs'
import {createOperationExecutor,OPERATION_CONTRACT,OperationDenied} from './operation-context.mjs'
import {organisationOnboardingSchemaDigest,normalizePolishNip,normalizeOrganisationSlug,normalizeCompanySelection,normalizeIndustry,normalizeProcurementCategories,normalizeTeamRange,normalizeCompanyRecord,organisationCommandDigest} from './organisation-profile.mjs'

export const ORGANISATION_BOOTSTRAP_CONTRACT=Object.freeze({id:'profitia.organisation-bootstrap',version:'1.0.0'})
export const organisationBootstrapSchemaUrl=new URL('../migrations/profile/008-organisation-create.sql',import.meta.url).href
export const organisationBootstrapSchemaDigest=()=>createHash('sha256').update(readFileSync(new URL(organisationBootstrapSchemaUrl))).digest('hex')
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const closed=v=>v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===Object.keys(v).length&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d&&d.enumerable)
const exact=(v,keys)=>closed(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')
const unavailable=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const ref=v=>typeof v==='string'&&v.length>0&&v.length<=256&&!/[\u0000-\u001f\u007f]|gh[pousr]_|sk_(?:live|test)_|postgres(?:ql)?:\/\/|Bearer\s/i.test(v)
function completeAnswers(value){
 if(!exact(value,['nip','slug','industry','categories','teamRange','companySelection'])||!Array.isArray(value.categories))return null
 try{
  const selection=normalizeCompanySelection(value.companySelection);if(!selection)return null
  const normalized={nip:normalizePolishNip(value.nip),slug:normalizeOrganisationSlug(value.slug),companySelection:selection,
   industry:normalizeIndustry({id:value.industry?.id,...(value.industry?.id==='other'?{label:value.industry.label}:{})}),
   categories:normalizeProcurementCategories(value.categories.map(c=>c.catalogueId?{catalogueId:c.catalogueId}:{customName:c.label})),
   teamRange:normalizeTeamRange(value.teamRange?.id)}
  return organisationCommandDigest(normalized)===organisationCommandDigest(value)?normalized:null
 }catch{return null}
}
function projectReceipt(value,commandId){
 if(exact(value,['status'])&&['INCOMPLETE_DRAFT','COMPANY_LOOKUP_REQUIRED','COMPANY_CHANGED','ORGANISATION_ALREADY_EXISTS','SLUG_UNAVAILABLE'].includes(value.status))return Object.freeze({...value})
 if(!exact(value,['status','organisationId','slug','activation','commandId'])||value.status!=='CREATED'||!uuid.test(value.organisationId??'')
  ||value.commandId!==commandId||value.activation!=='PENDING_PACKAGE'||normalizeOrganisationSlug(value.slug)!==value.slug)unavailable()
 return Object.freeze({...value})
}
/** Reuses shared Root, Clerk verification and the ordinary access-store lease.
 * readVerifiedCompany is the server-owned, governed STORED company-registry
 * reader. It may return null. A paid General fallback needs independent Source
 * admission and is deliberately never triggered by this create operation.
 * The caller owns the physical transaction and deployment/SQL activation.
 */
export function createOrganisationBootstrapBackend(options){
 const {client,schemaDigest,proofKey,independentQuery,transact,readVerifiedCompany,now=Date.now}=options
 const binding=structuredClone(options.binding)
 const application=structuredClone(options.application),identityApplication=structuredClone(options.identityApplication)
 if(binding?.service!==undefined||typeof independentQuery!=='function'||typeof transact!=='function'||typeof readVerifiedCompany!=='function'
  ||identityApplication?.appId!==application?.appId||identityApplication?.issuer!==application?.identityIssuer
  ||identityApplication?.environment!==application?.environment||identityApplication?.bearerPeerReads?.length)throw TypeError('Same-receiver HUMAN bootstrap and governed stored-company reader required')
 const store=createAccessStore({binding,now}),sql=createProfileSql({binding,issuer:identityApplication.issuer,schemaDigest,proofKey,now})
 const schema=organisationBootstrapSchemaDigest(),draftSchema=organisationOnboardingSchemaDigest(),transactions=new WeakMap()
 async function descriptor(query){
  await sql.descriptor(query)
  const {descriptor:d,onboarding}=await sql.queryOne(query,'SELECT profitia_profile.organisation_bootstrap_descriptor() AS descriptor,profitia_profile.organisation_onboarding_descriptor() AS onboarding')
  if(d?.schemaDigest!==schema||onboarding?.schemaDigest!==draftSchema||!uuid.test(d?.policyId??'')||!/^[1-9][0-9]*$/.test(d?.policyVersion??'')||!ref(d?.sourceRef)||!(Date.parse(d?.expiresAt)>now()))unavailable()
  return d
 }
 function executorFor(httpRequest,onConflict){
 let identityKey
 const authenticate=createClerkIdentityAuthenticator({client,application:identityApplication,resolveBinding:async key=>{identityKey=structuredClone(key);return store.resolveBinding(independentQuery,key)},now})
 return createOperationExecutor({application,organisationBootstrapSchemaDigest:schema,now,authenticate,
  recordAudit:event=>store.appendAudit(independentQuery,event),
  withTransaction:async({actor,request},run)=>{
   let entered=false,completed=false,closed=false,owned
   try{
    const result=await transact(async session=>{
     if(entered||!session?.transaction||typeof session.query!=='function')unavailable()
     entered=true
     const query=async(text,values)=>{if(closed)unavailable();const r=await session.query(text,values);if(closed)unavailable();return r}
     await query("SET LOCAL statement_timeout='12000ms'")
     await query("SET LOCAL lock_timeout='5000ms'")
     await query("SET LOCAL idle_in_transaction_session_timeout='15000ms'")
     await descriptor(query)
     await sql.queryOne(query,'SELECT profitia_profile.organisation_bootstrap_lock() AS locked')
     if(!identityKey)unavailable()
     const observedBinding=await store.resolveBinding(query,identityKey)
     const verify=createClerkIdentityAuthenticator({client,application:identityApplication,now,resolveBinding:key=>store.resolveBinding(query,key)})
     const lease=await store.lockAccess(query,{actor,identityBinding:observedBinding,organisationId:null})
     const proof=await sql.attest(query,{operation:'organisation.create.admit',principal:actor.userId,
      issuer:request.payload.commandId+':'+request.payload.draftVersion,expiresAt:Math.min(Date.parse(actor.expiresAt),Date.parse(lease.expiresAt))})
     const {admission}=await sql.queryOne(query,'SELECT profitia_profile.organisation_bootstrap_state($1::uuid,$2::bigint,$3::bigint,$4) AS admission',
      [request.payload.commandId,request.payload.draftVersion,proof.until,proof.signature])
     const policy=admission?.policy
     if(!policy||policy.schemaDigest!==schema)unavailable()
     policy.expiresAt=new Date(Math.min(Date.parse(policy.expiresAt),Date.parse(lease.expiresAt),now()+29000)).toISOString()
     const resource={id:'current-organisation-onboarding',type:'organisation',dataClass:'ORGANISATION_PRIVATE',environment:binding.environment,
      ownerOrganisationId:null,ownerUserId:null,version:request.payload.draftVersion,projectionVersion:'organisation-bootstrap-v1'}
     transactions.set(session.transaction,{query,admission,lease,request:httpRequest})
     const state={...lease.state,bootstrapPolicy:policy,products:[],usagePolicy:'ONBOARDING_POLICY',resource,
      access:{...lease.state.access,type:'BOOTSTRAP',version:policy.policyVersion,sourceRef:policy.sourceRef,expiresAt:policy.expiresAt,
       permissions:[{operation:'organisation.create',feature:'organisation_admin',resourceId:resource.id}],denies:[]}}
     try{
      owned=await run({state,transaction:session.transaction,transactionalEffects:true,outputBoundaryVersion:resource.projectionVersion,
       projectOutput:value=>projectReceipt(value,request.payload.commandId),describeOutcome:value=>value.status==='CREATED'?'SUCCEEDED':'NO_DATA',
       recordOutcome:async event=>{
        const verified=await verify(httpRequest)
        if(!verified||verified.userId!==actor.userId||verified.proofRef!==actor.proofRef)throw new OperationDenied('ACCESS_BASIS_INVALID')
        await descriptor(query);await store.appendAudit(query,event,lease)
       }})
      await store.verifyScope(query,lease);completed=true;return owned
     }finally{transactions.delete(session.transaction)}
    },{timeoutMs:15000,maxWaitMs:5000})
    if(!entered||!completed||result!==owned)unavailable()
    return result
   }catch(error){if(error instanceof ProfileConflict)onConflict();throw error}finally{closed=true}
  }})
 }
 executorFor(null,()=>{})
 return Object.freeze({contract:ORGANISATION_BOOTSTRAP_CONTRACT,ready:()=>descriptor(independentQuery),
  async completeCurrentOrganisation(request,input){
   if(!(request instanceof Request)||request.method!=='POST'||!exact(input,['commandId','draftVersion'])||!uuid.test(input.commandId??'')
    ||typeof input.draftVersion!=='string'||!/^[1-9][0-9]{0,18}$/.test(input.draftVersion)||BigInt(input.draftVersion)>9223372036854775806n)throw TypeError('Explicit versioned onboarding completion required')
   const commandId=input.commandId.toLowerCase(),draftVersion=input.draftVersion;let conflict=false
   try{
    const result=await executorFor(request,()=>{conflict=true}).execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'organisation.create',
     organisationId:null,resourceId:'current-organisation-onboarding',idempotencyKey:commandId,payload:{commandId,draftVersion},request},
    async(context,transaction)=>{
     const unit=transactions.get(transaction);if(!unit)unavailable()
     if(unit.admission.receipt)return projectReceipt(unit.admission.receipt,commandId)
     const answers=completeAnswers(unit.admission.draft);if(!answers)return {status:'INCOMPLETE_DRAFT'}
     const stored=await readVerifiedCompany(Object.freeze({nip:answers.nip,context}))
     if(stored===null)return {status:'COMPANY_LOOKUP_REQUIRED'}
     if(!exact(stored,['company','sourceRef','version'])||!ref(stored.sourceRef)||!ref(stored.version))unavailable()
     if(stored.sourceRef!==answers.companySelection.sourceRef||stored.version!==answers.companySelection.version)return {status:'COMPANY_CHANGED'}
     const company=normalizeCompanyRecord(stored.company,answers.nip)
     const payload=JSON.stringify({commandId,draftVersion,answers,company,registryRef:stored.sourceRef,registryVersion:stored.version})
     const digest=createHash('sha256').update(payload).digest('hex')
     const proof=await sql.attest(unit.query,{operation:'organisation.create.commit',principal:context.actorId,
      issuer:commandId+':'+digest,expiresAt:Math.min(Date.parse(context.actor.expiresAt),Date.parse(unit.lease.expiresAt))})
     try{return(await sql.queryOne(unit.query,'SELECT profitia_profile.organisation_bootstrap_create($1,$2::bigint,$3,$4::uuid) AS receipt',
      [payload,proof.until,proof.signature,context.decisionId])).receipt}
     catch(error){if(error instanceof ProfileConflict)conflict=true;throw error}
    })
    return result.value
   }catch(error){if(conflict&&error?.reasonCode==='POLICY_UNAVAILABLE')throw new ProfileConflict();throw error}
  }})
}
