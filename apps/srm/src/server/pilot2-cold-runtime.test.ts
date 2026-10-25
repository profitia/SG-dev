import test from 'node:test'
import assert from 'node:assert/strict'
import {readPilot2ColdConfiguration} from './pilot2-cold-runtime'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
const connection=(role:string)=>'postgresql://'+role+':synthetic_only@ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech/platform_private?sslmode=require'
const fixture=()=>({SRM_PILOT2_COLD_ACQUISITION:'true',SRM_PILOT2_PRIVATE_SCANNER:'true',
 PILOT2_E1_SOURCE_URL:connection('srm_pilot2_source'),PILOT2_E1_CORPORATE_URL:connection('srm_pilot2_corporate'),
 MGBI_API_KEY:'synthetic',CEIDG_API_KEY:'synthetic',VERCLY_API_KEY:'synthetic',VERCLY_API_BASE_URL:'https://synthetic.invalid/'})
test('Cold composition accepts only its two ordinary technical credentials and required named provider configuration',()=>{
 const config=readPilot2ColdConfiguration(fixture())
 assert.equal(config.source.user,'srm_pilot2_source');assert.equal(config.corporate.user,'srm_pilot2_corporate')
 assert.equal(config.source.ssl.rejectUnauthorized,true)
 for(const key of Object.keys(fixture()))assert.throws(()=>readPilot2ColdConfiguration({...fixture(),[key]:undefined}),isOperationDenied,key)
 for(const role of['neondb_owner','profitia_access_owner','srm_krs_pilot_source','srm_pilot2_jobs']){
  assert.throws(()=>readPilot2ColdConfiguration({...fixture(),PILOT2_E1_SOURCE_URL:connection(role)}),isOperationDenied)
 }
 for(const change of['?sslmode=disable','?sslmode=require&options=-c%20role=profitia_access_owner']){
  assert.throws(()=>readPilot2ColdConfiguration({...fixture(),PILOT2_E1_SOURCE_URL:connection('srm_pilot2_source').split('?')[0]+change}),isOperationDenied)
 }
 assert.throws(()=>readPilot2ColdConfiguration({...fixture(),PILOT2_E1_SOURCE_URL:connection('srm_pilot2_source').replace('/platform_private','/srm_app')}),isOperationDenied)
})
