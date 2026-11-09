import {createAccessStore} from './access-store.mjs'
import {createOperationExecutor,OperationDenied,ASSISTANT_ROOT_CONTRACT} from './operation-context.mjs'

export const ASSISTANT_OPERATION_HOST_CONTRACT=Object.freeze({id:'profitia.assistant-operation-host',version:'1.0.0'})
const operations=['assistant.converse','assistant.history.read','assistant.history.write']
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const deny=(code='POLICY_UNAVAILABLE')=>{throw new OperationDenied(code)}
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}

/** Explicit native E1 adoption. No HTTP actor, ALLOW flag, identity cache or
 * permission substitute. Every call obtains a fresh official identity proof and
 * the existing canonical account/membership lease inside its real transaction. */
export function createAssistantOperationHost(options){
 const{application,binding,independentQuery,transact,createAuthenticator,readResources,projectOutput,usage,assistantSchemaDigest,now=Date.now}=options
 if(application?.appId!=='spendguru'||application.profileId!=='SPENDGURU_SAAS'||application.environment!=='development'
  ||binding?.applicationId!=='spendguru'||binding.environment!=='development'||binding.role!=='sg2_private_development_runtime'
  ||binding.projectId!=='spring-bread-28217539'||binding.branchId!=='br-sparkling-term-b99l107x'||binding.databaseName!=='platform_private'
  ||!Array.isArray(application.operations)||!application.operations.length||application.operations.some(op=>!operations.includes(op))
  ||application.features?.join(',')!=='assistant'||!/^[a-f0-9]{64}$/.test(assistantSchemaDigest??'')
  ||[independentQuery,transact,createAuthenticator,readResources,projectOutput,now,usage?.reserve,usage?.release,usage?.pending].some(fn=>typeof fn!=='function'))
  throw TypeError('Explicit Development Assistant E1 and Limits adoption required')
 const store=createAccessStore({binding,now})
 return Object.freeze({contract:ASSISTANT_ROOT_CONTRACT,hostContract:ASSISTANT_OPERATION_HOST_CONTRACT,
  async execute(input,action){
   let identityBinding=null,reservation=null,committed=false
   const executor=createOperationExecutor({application,assistantSchemaDigest,now,
    authenticate:async request=>{
     const authenticate=createAuthenticator({resolveBinding:async key=>{
      if(identityBinding!==null)deny()
      identityBinding=await store.resolveBinding(independentQuery,key);return identityBinding
     }})
     if(typeof authenticate!=='function')deny()
     const actor=await authenticate(request)
     if(actor&&!identityBinding)deny()
     return actor
    },
    recordAudit:event=>store.appendAudit(independentQuery,event),
    withTransaction:async({actor,request},run)=>{
     if(!identityBinding)deny('UNVERIFIED_IDENTITY')
     let entered=false,closed=false,result
     try{
      result=await transact(async({query,transaction})=>{
       if(entered||closed||query===independentQuery||typeof query!=='function'||transaction==null)deny();entered=true
       const lease=await store.lockAccess(query,{actor,identityBinding,organisationId:request.organisationId})
       const rows=await query('SELECT profitia_assistant_access.current_pilot($1::uuid,$2::uuid,$3::text) AS pilot',
        [actor.actorId,request.organisationId,assistantSchemaDigest])
       const pilot=rows.rows?.[0]?.pilot
       if(rows.rows?.length!==1||!pilot||pilot.schemaDigest!==assistantSchemaDigest||pilot.userId!==actor.actorId
        ||pilot.organisationId!==request.organisationId||!uuid.test(pilot.pilotOrganisationId??'')
        ||pilot.transactionId!==lease.transactionId||!/^\d+$/.test(pilot.version??'')||!(Date.parse(pilot.expiresAt)>now())
        ||!uuid.test(pilot.limitsPolicyId??'')||!uuid.test(pilot.limitsAssignmentId??'')||!Number.isSafeInteger(pilot.limitsAssignmentRevision)
        ||pilot.limitsAssignmentRevision<1||typeof pilot.sourceRef!=='string'||!pilot.sourceRef)deny('PERMISSION_DENIED')
       const scope=freeze({applicationId:'spendguru',environment:'development',userId:actor.actorId,organisationId:request.organisationId})
       const resources=await readResources({actor,request,scope,query,transaction})
       if(!resources?.resource||Object.keys(resources).some(k=>k!=='resource'))deny()
       const state=structuredClone(lease.state)
       state.access.expiresAt=new Date(Math.min(Date.parse(state.access.expiresAt),Date.parse(pilot.expiresAt))).toISOString()
       if(request.organisationId===null){
        state.access.permissions.push(...operations.filter(op=>op!=='assistant.converse').map(operation=>({operation,feature:'assistant',resourceId:null})))
       }else{
        // Technical projection of the separately installed, owner-confirmed
        // Limits assignment; the real assignment is rechecked by each reserve.
        state.products.push({product:'SPENDGURU',features:['assistant'],organisationId:request.organisationId,
         environment:'development',applicationId:'spendguru',status:'ACTIVE',version:'assistant-pilot:'+pilot.version,
         sourceRef:pilot.sourceRef,source:'EXPLICIT_OFFER',expiresAt:pilot.expiresAt})
       }
       state.resource=resources.resource
       state.usagePolicy=request.operation==='assistant.converse'?'PRODUCT_POLICY':'NOT_APPLICABLE'
       const value=await run({state,transaction,transactionalEffects:true,outputBoundaryVersion:resources.resource.projectionVersion,
        reserveAssistantUsage:async context=>{
         if(closed||reservation)deny()
         reservation=await usage.reserve({actorId:context.actorId,organisationId:context.organisationId,
          commandId:context.payload.commandId,decisionId:context.decisionId,input:context.payload.input,
          expectedPolicy:{id:pilot.limitsPolicyId,assignmentId:pilot.limitsAssignmentId,assignmentRevision:pilot.limitsAssignmentRevision}})
         return reservation
        },
        projectOutput:async(value,context)=>{if(closed)deny();await store.verifyScope(query,lease);return projectOutput(value,context)},
        recordOutcome:async event=>{if(closed)deny();await store.verifyScope(query,lease);await store.appendAudit(query,event,lease)},
       })
       if(closed)deny();await store.verifyScope(query,lease);return value
      },{timeoutMs:10000,maxWaitMs:3000})
      committed=true;return result
     }finally{closed=true}
    },
   })
   try{return await executor.execute(input,action)}catch(error){
    if(reservation&&!committed&&reservation.status==='RESERVED'){
     try{await usage.release(reservation)}catch{await usage.pending(reservation,'AUTH_REVOKED')}
    }
    throw error
   }
  },
 })
}
