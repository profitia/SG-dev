import test from 'node:test'
import assert from 'node:assert/strict'
import {srmProviderSourcePolicy,createSrmProviderSourceTransport} from './provider-source-transport'
test('organisation bootstrap owns a separate MGBI budget and only the original General record endpoint',()=>{
 const policy=srmProviderSourcePolicy('MGBI_ONBOARDING')
 assert.equal(policy.source.id,'srm.provider.mgbi-onboarding');assert.equal(policy.resourceId,'srm-provider:mgbi-onboarding')
 assert.deepEqual(policy.pathRules,[{method:'GET',path:'/v1/models/pl-krs-wp-record/records',requestFormat:'NONE'}])
 assert.deepEqual(policy.basePathRules,[{method:'GET',path:'/v1/models/pl-krs-wp-record/records'}])
 const original=srmProviderSourcePolicy('MGBI')
 assert.equal(original.source.id,'srm.provider.mgbi');assert.equal(original.pathRules.length,2)
 assert(original.pathRules.some(p=>'path'in p&&p.path==='/v1/models/pl-krs-rdf-record/records'))
 assert.throws(()=>createSrmProviderSourceTransport({provider:'MGBI_ONBOARDING'} as any),/Explicit original provider/)
})
