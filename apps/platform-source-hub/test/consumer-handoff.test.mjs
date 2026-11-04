// SYNTHETIC_ONLY. Compatibility proposal for inactive consumers, not their
// adoption, production adapter, content verification or live provider proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,command,U,A} from './fixtures.mjs';
import {createApplication} from '../src/server.mjs';
import {createSourceHubClient} from '../../newsfeed-runtime/src/source-hub-client.mjs';

test('SYNTHETIC_ONLY: shared API supplies calendar input and unconfirmed Oil evidence candidates without a consumer provider adapter',async t=>{
 const f=await fixture();t.after(()=>f.close());
 const app=createApplication({configuration:f.hub,repository:f.hubRepository,authorizer:f.hubAuthorizer,admission:f.admission,telemetry:{requestId:()=>crypto.randomUUID(),emit:e=>f.logs.push(e)}});
 const client=createSourceHubClient(f.newsfeed,{fetchImpl:r=>app.handle(r)}),request=new Request(f.newsfeed.publicOrigin+'/operation',{headers:{authorization:'Bearer SYNTHETIC_A'}});
 const acquire=(provider,family,criteria,key)=>client.acquire({request,command:{...command,provider,family,criteria},context:{organisationId:A,expectedUserId:U},idempotencyKey:key});
 const calendar=await acquire('trading-economics','economic-calendar',{countries:['Poland'],importance:1,eventText:'CPI'},'consumer-calendar');
 assert.equal(calendar.items[0].payload.country,'Poland');assert.equal(calendar.items[0].payload.actual,0);assert.equal(calendar.items[0].payload.consensusForecast,2);assert.equal(calendar.items[0].payload.vendorForecast,3);assert.equal(calendar.items[0].payload.previous,4);assert.equal(calendar.items[0].payload.revised,5);assert.equal(calendar.items[0].payload.releaseStatus,'REPORTED');assert.equal(calendar.coverage.completeness,'UNKNOWN');
 const commentary=await acquire('trading-economics','news-discovery',{newsType:'markets'},'consumer-te-news');
 const search=await acquire('brave','news-discovery',{text:'"crude oil" AND (asphalt OR OPEC) NOT sports',country:'US',language:'en',freshness:'pw',spellcheck:false},'consumer-brave');
 const indicators=await acquire('trading-economics','indicators',{countries:['Poland'],indicators:['Inflation Rate']},'consumer-indicators');
 const forecasts=await acquire('trading-economics','external-forecasts',{countries:['Poland'],indicators:['Inflation Rate'],horizons:['q1']},'consumer-forecasts');
 // OilMarketEvidence input in PR867, blob 11f85f3e2df66db8d2db4a1d13b506933bcecf2b.
 // This test builds only candidates. Insights owns selection/verification and
 // makeOilEvidenceBundle; no frozen D0, Composer or report publication is used.
 const candidates=[...commentary.items,...search.items].map((record,index)=>({id:'HUB_'+index,publisher:record.payload.publisher?.name??record.metadata.providerId,title:record.payload.title,url:record.payload.url,
  publicationDate:record.payload.publishedAt,eventDate:null,retrievedAt:record.metadata.retrievedAt,summary:record.payload.description,licence:record.metadata.licenceRef,
  verification:'UNCONFIRMED',kind:'FACT',availableAt:record.metadata.availableAt}));
 assert.equal(candidates.length,2);
 for(const candidate of candidates){assert(candidate.id.startsWith('HUB_'));assert.equal(new URL(candidate.url).protocol,'https:');assert.equal(candidate.verification,'UNCONFIRMED');assert.equal(candidate.licence,'SYNTHETIC_ONLY');assert.equal(candidate.availableAt,null);assert(candidate.summary);}
 const sourceRecords=[...calendar.items,...commentary.items,...search.items,...indicators.items,...forecasts.items];
 for(const record of sourceRecords){assert.equal(record.metadata.redistribution,'PRIVATE_AUTHORISED_CONSUMER_ONLY');assert(record.metadata.licenceRef);assert(record.metadata.usageReceiptRef);assert(record.metadata.retentionUntil);assert.match(record.metadata.contentFingerprint,/^[a-f0-9]{64}$/);}
 assert.equal(indicators.items[0].payload.value,0);assert.equal(forecasts.items[0].payload.forecastCorePrediction,false);assert.equal(search.coverage.operatorSemantics,'EXPERIMENTAL_UNVERIFIED');
 assert.equal(f.state.providerCalls.length,5);assert(!JSON.stringify(f.logs).includes('crude oil'));assert(!JSON.stringify(f.logs).includes('SYNTHETIC_A'));
});
