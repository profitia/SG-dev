import assert from 'node:assert/strict'
import test from 'node:test'
import {createDelegatedJobHost,createPrivateOperationHost,createServiceReadHost} from '../src/private-operation-host.mjs'
import {createRequestContinuationLedger,delegatedPrivatePhasesSchemaDigest} from '../src/request-continuation.mjs'
const digest='a'.repeat(64),requestId='11111111-1111-4111-8111-111111111111'
const application={appId:'supplier-jobs',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'fixture',configurationVersion:'1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['job.execute'],features:['job_execution']}
const binding={applicationId:application.appId,environment:'development',projectId:'fixture-project',branchId:'fixture-branch',databaseName:'fixture',role:'ordinary_role',schemaDigest:digest,service:{schemaDigest:digest,profileId:application.profileId,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion}}
const query=async()=>{throw Error('Constructors never query or authenticate')}
const options=()=>({application,binding,job:{schemaDigest:digest,targetOperation:'supplier.report.refresh',supplierSchemaDigest:digest},independentQuery:query,transact:query,readExternalAccount:query})
const c={requestId,phaseId:'REGISTER_LOOKUP',inputDigest:digest,schemaDigest:digest,delegatedSchemaDigest:digest}
test('private phases require an explicit Supplier opt-in, leave defaults closed and expose no source delivery',async()=>{
 const o=options(),ordinary=createDelegatedJobHost(o)
 assert.equal(ordinary.runPrivatePhase,undefined)
 const host=createDelegatedJobHost({...o,privateContinuation:{schemaDigest:digest,delegatedSchemaDigest:digest}})
 assert.equal(typeof host.runPrivatePhase,'function');assert.equal(host.deliver,undefined);assert(Object.isFrozen(host))
 assert.match(await delegatedPrivatePhasesSchemaDigest(),/^[a-f0-9]{64}$/)
 const ledger=createRequestContinuationLedger({executionMode:'DELEGATED_SERVICE',binding,continuation:c})
 assert.equal(ledger.loadPolicy,undefined);assert.equal(typeof ledger.loadPhase,'function')
 assert.throws(()=>ledger.evidence({}),e=>e.reasonCode==='POLICY_UNAVAILABLE')
})
for(const patch of [
 {privateContinuation:null},{privateContinuation:{}},{privateContinuation:{schemaDigest:digest,delegatedSchemaDigest:digest,authority:true}},
 {privateContinuation:{schemaDigest:digest,delegatedSchemaDigest:'wrong'}},{sourceDelivery:{deliver:query}},
 {job:{schemaDigest:digest}},{job:{schemaDigest:digest,targetOperation:'forecast.request'}},{delegatedContinuation:c}
])test('refuse mixed, implicit or expanded Service phase configuration '+JSON.stringify(patch),()=>{
 assert.throws(()=>createDelegatedJobHost({...options(),privateContinuation:{schemaDigest:digest,delegatedSchemaDigest:digest},...patch}),TypeError)
})
for(const phase of [null,{}, {phaseId:'REGISTER_LOOKUP',inputDigest:digest,authority:true}, {phaseId:'REGISTER_LOOKUP',inputDigest:digest,[Symbol('hidden')]:true}])test('closed phase call refuses caller authority '+String(phase),()=>{
 const host=createDelegatedJobHost({...options(),privateContinuation:{schemaDigest:digest,delegatedSchemaDigest:digest}})
 assert.throws(()=>host.runPrivatePhase({resourceId:requestId},phase,query),TypeError)
})
for(const patch of [{phaseId:'FETCH_PROVIDER'},{phaseId:'forecast.request'},{phaseId:'*'},{requestId:'forged'},{delegatedSchemaDigest:null},{inputDigest:'content'}])test('the same ledger rejects unbounded or malformed delegated phases '+JSON.stringify(patch),()=>{
 assert.throws(()=>createRequestContinuationLedger({executionMode:'DELEGATED_SERVICE',binding,continuation:{...c,...patch}}),TypeError)
})
test('Service phases cannot borrow a HUMAN quota adapter or accept an unregistered mode',()=>{
 assert.throws(()=>createRequestContinuationLedger({executionMode:'DELEGATED_SERVICE',binding,continuation:c,ledger:{}}),TypeError)
 assert.throws(()=>createRequestContinuationLedger({executionMode:'AUTOMATIC',binding,continuation:c}),TypeError)
 assert.throws(()=>createRequestContinuationLedger({executionMode:'DELEGATED_SERVICE',binding:{...binding,service:undefined},continuation:c}),TypeError)
})
test('other host families cannot receive the internal delegated phase option',()=>{
 for(const key of ['privateContinuation','delegatedContinuation']){
  assert.throws(()=>createPrivateOperationHost({...options(),[key]:c}),TypeError)
  assert.throws(()=>createServiceReadHost({...options(),[key]:c}),TypeError)
 }
})
