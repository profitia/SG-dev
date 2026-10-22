import test from 'node:test'
import assert from 'node:assert/strict'
import {krsPilotDatabaseUrl,srmKrsPilotTarget} from './krs-native-runtime'
import pilot from '../../deployment/krs-live-pilot.json'

test('KRS catalog connections require the isolated database, exact ordinary role and verified TLS',()=>{
 const valid='postgresql://krs_reader:synthetic_password@ep-dry-hat-bafvyimb.c-8.eu-central-1.aws.neon.tech/krs_registry_pilot?sslmode=require&channel_binding=require'
 assert.equal(krsPilotDatabaseUrl(valid,'krs_reader'),valid)
 for(const candidate of [undefined,' '+valid,valid.replace('krs_registry_pilot','architecture_srm_lab'),valid.replace('krs_reader','architecture_sg_lab_owner'),valid.replace('require','disable'),valid+'&options=-c%20role%3Dkrs_catalog_owner',valid+'#ignored',valid.replace('ep-dry-hat','foreign')])assert.throws(()=>krsPilotDatabaseUrl(candidate,'krs_reader'))
 assert.throws(()=>krsPilotDatabaseUrl(valid,'krs_ingest'))
})
test('only the exact accepted Development service can select pilot bindings',()=>{
 assert.equal(srmKrsPilotTarget({RENDER_SERVICE_ID:'srv-db1vu6gm7kps73d0e3r0',TARGET_ENVIRONMENT:'development'}),null)
 assert.throws(()=>srmKrsPilotTarget({RENDER_SERVICE_ID:pilot.render.serviceId,TARGET_ENVIRONMENT:'production'}))
 if(pilot.state==='ACCEPTED_RUNTIME_BINDINGS')assert.equal(srmKrsPilotTarget({RENDER_SERVICE_ID:pilot.render.serviceId,TARGET_ENVIRONMENT:'development'}),pilot)
 else assert.throws(()=>srmKrsPilotTarget({RENDER_SERVICE_ID:pilot.render.serviceId,TARGET_ENVIRONMENT:'development'}))
})
