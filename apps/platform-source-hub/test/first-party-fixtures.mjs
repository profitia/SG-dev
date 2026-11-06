// SYNTHETIC_ONLY, combines current E1 and the existing real Root/Source SQL
// fixture. Provider transport is offline, never a live provider response.
import {firstPartyFixture} from '../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs';
import {fixture} from './fixtures.mjs';
import {createConsumerAccess} from '../src/consumer-access.mjs';
import {createApplication} from '../src/server.mjs';
import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client';
export async function consumerFixture(){
 const e1=await firstPartyFixture();let source;
 try{source=await fixture();
  const rows=await source.admin(0,'source_hub_development_owner',q=>q.query('SELECT * FROM source_hub.provider_licences'));
  await e1.asOwner(1,async q=>{for(const l of rows.rows)await q.query('UPDATE source_hub.provider_licences SET source_policy_id=$1 WHERE provider_id=$2 AND family=$3',[l.source_policy_id,l.provider_id,l.family]);},'source_hub_development_owner');
  const b=e1.bindings[1],configuration={...source.hub,projectId:b.projectId,branchId:b.branchId,databaseName:b.databaseName,configurationVersion:'fixture-v1',legacyPeerEnabled:false};
  const access=await createConsumerAccess(configuration,e1.db(1),{fetch:e1.sourceTransport});
  const logs=[],app=createApplication({configuration,authorizer:null,repository:null,consumerAccess:access,admission:source.admission,telemetry:{requestId:()=>crypto.randomUUID(),emit:e=>logs.push(e)}});
  const client=async options=>{const signed=await e1.makeSigned(options);return createFirstPartySourceHubClient(signed.configuration,{fetchImpl:request=>app.handle(request)});};
  return {e1,source,app,access,logs,client,async close(){try{await source.close();}finally{await e1.close();}}};
 }catch(e){if(source)await source.close();await e1.close();throw e;}
}
