// Synthetic offline provider fixtures. No network or live-market claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTradingEconomics,createTradingEconomicsProvider} from '../src/providers/trading-economics.mjs';
import {parseHubRequest,assertHubResponse} from '../../../packages/platform-source-hub-contracts/index.mjs';
const now='2026-11-06T10:00:00.000Z';
function fixture(rows){let calls=0;return {provider:createTradingEconomicsProvider({apiKey:'SYNTHETIC_ONLY_NO_LIVE_ACCESS',now:()=>now,fetchImpl:async()=>{calls++;return Response.json(rows);}}),count:()=>calls};}
const q=criteria=>({contractVersion:'1.0.0',provider:'trading-economics',family:'market-observations',operation:'search',criteria});
test('snapshot resolves actual returned symbols from canonical commodity URLs, with only local subset claims',async()=>{
 const row={Symbol:'TEST:COM',Name:'Synthetic commodity',Date:'2026-11-06T09:00:00',Last:0,Unit:'CNY/T',Type:'commodity',URL:'/commodity/synthetic',WeeklyChange:0};
 const f=fixture([row,{...row,Symbol:'OTHER:COM',URL:'/commodity/other'}]),r=await f.provider.search('market-observations',{mode:'snapshot',instrumentUrls:['https://tradingeconomics.com/commodity/synthetic']});
 assert.equal(f.count(),1);assert.equal(r.items.length,1);const p=r.items[0].payload;assert.equal(p.vendorSymbol,'TEST:COM');assert.equal(p.price,0);assert.equal(p.currency,null);assert.equal(p.instrumentType,null);assert.equal(p.marketType,'commodity');assert.equal(p.quoteBasis,'VENDOR_LAST');assert.equal(p.mappingStatus,'NOT_ADOPTED_BY_MARKET_DATA');assert.equal(r.coverage.providerReturned,2);assert.equal(r.coverage.completeness,'UNKNOWN');
 assert.equal(new URL(prepareTradingEconomics('market-observations',{mode:'snapshot'}).url).pathname,'/markets/commodities');
});
test('dated history preserves day precision, zero prices, OHLC and missing unit/currency instead of borrowing snapshot facts',async()=>{
 const criteria={mode:'historical',symbols:['test:com'],from:'2026-11-01',to:'2026-11-06'};const plan=prepareTradingEconomics('market-observations',criteria),url=new URL(plan.url);assert.equal(url.pathname,'/markets/historical/TEST:COM');assert.equal(url.searchParams.get('d1'),'2026-11-01');assert.equal(url.searchParams.get('d2'),'2026-11-06');
 const f=fixture([{Symbol:'TEST:COM',Date:'05/11/2026',Open:1,High:2,Low:0,Close:0}]),r=await f.provider.search('market-observations',criteria),p=r.items[0].payload;assert.equal(p.observationAt,'2026-11-05T00:00:00.000Z');assert.equal(p.temporalPrecision,'DAY');assert.equal(p.price,0);assert.equal(p.quoteBasis,'VENDOR_CLOSE');assert.equal(p.unit,null);assert.equal(p.currency,null);assert.equal(p.ohlc.low,0);assert.equal(r.items[0].metadata.availableAt,null);
});
test('malformed history selectors and unsupported combinations are refused before provider I/O',()=>{
 for(const c of[{mode:'historical',symbols:['TEST:COM']},{mode:'historical',symbols:['TEST:COM'],from:'2026-11-06',to:'2026-11-01'},{mode:'historical',symbols:['TEST:COM/owner'],from:'2026-11-01',to:'2026-11-06'},{mode:'snapshot',from:'2026-11-01'},{mode:'snapshot',instrumentUrls:['https://other.example/commodity/a']},{mode:'snapshot',apiKey:'secret'}])assert.throws(()=>prepareTradingEconomics('market-observations',c));
 assert.deepEqual(parseHubRequest(q({mode:'snapshot'})),q({mode:'snapshot'}));assert.throws(()=>parseHubRequest({...q({mode:'snapshot'}),provider:'newsapi'}));
});
test('unexpected historical symbol and invalid market date fail instead of contaminating the selected series',async()=>{
 const c={mode:'historical',symbols:['TEST:COM'],from:'2026-11-01',to:'2026-11-06'};await assert.rejects(fixture([{Symbol:'OTHER:COM',Date:'05/11/2026',Close:1}]).provider.search('market-observations',c),{code:'INVALID_RESPONSE'});
 await assert.rejects(fixture([{Symbol:'TEST:COM',Date:'31/02/2026',Close:1}]).provider.search('market-observations',c),{code:'INVALID_RESPONSE'});
 for(const date of[null,'2026-10-31','2026-11-07'])await assert.rejects(fixture([{Symbol:'TEST:COM',Date:date,Close:1}]).provider.search('market-observations',c),{code:'INVALID_RESPONSE'});
});
test('market wire response still requires current provenance/receipt and never claims a canonical Market Data mapping',async()=>{
 const command=q({mode:'snapshot'}),r=await fixture([{Symbol:'TEST:COM',Date:'2026-11-06T09:00:00',Last:1}]).provider.search('market-observations',command.criteria);
 const receipt='11111111-1111-4111-8111-111111111111';r.provenance.licenceRef='SYNTHETIC_ONLY';r.usage.receiptRef=receipt;for(const i of r.items)Object.assign(i.metadata,{licenceRef:'SYNTHETIC_ONLY',usageReceiptRef:receipt,retentionUntil:null,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY'});
 assert.equal(assertHubResponse(r,command),r);const bad=structuredClone(r);bad.items[0].payload.mappingStatus='CANONICAL';assert.throws(()=>assertHubResponse(bad,command));
});

test('SYNTHETIC_ONLY local PostgreSQL: optional symbol SQL preserves existing six source policies and scopes', {skip:!process.env.SOURCE_HUB_TEST_ADMIN_URL},async()=>{
 const {fixture}=await import('./fixtures.mjs'),{readFileSync}=await import('node:fs'),{createHash}=await import('node:crypto');const f=await fixture();
 try{
  await f.admin(0,'profitia_ingestion_owner',async q=>{
   const before=(await q.query('SELECT to_jsonb(p) AS row FROM profitia_external_native.policies p ORDER BY policy_id')).rows;
   const file=new URL('../../../packages/platform-contracts/migrations/access/029-market-symbol-transport.sql',import.meta.url),sql=readFileSync(file,'utf8');await q.query(sql);
   await q.query("INSERT INTO profitia_external_market_symbol.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')",[createHash('sha256').update(sql).digest('hex')]);
   const after=(await q.query('SELECT to_jsonb(p) AS row FROM profitia_external_native.policies p ORDER BY policy_id')).rows;assert.deepEqual(after,before);
   const rule={method:'GET',prefix:'/markets/historical/',parameter:'MARKET_SYMBOL',suffix:'',requestFormat:'NONE'};
   assert.equal((await q.query('SELECT profitia_external_native.valid_rules($1::jsonb) AS ok',[JSON.stringify([rule])])).rows[0].ok,true);
   assert.equal((await q.query('SELECT profitia_external_native.valid_rules($1::jsonb) AS ok',[JSON.stringify([{...rule,prefix:'/arbitrary/'}])])).rows[0].ok,false);
  });
  assert.equal(await f.admission.ready(),true);
  await f.admin(0,'source_hub_development_owner',async q=>{const registration=readFileSync(new URL('../migrations/006-market-observations.sql',import.meta.url),'utf8');await q.query(registration);await q.query(registration);assert.equal((await q.query("SELECT status FROM source_hub.api_families WHERE id='market-observations'")).rows[0].status,'IMPLEMENTED');const n=(await q.query('SELECT count(*)::int AS n FROM source_hub.provider_licences')).rows[0].n;assert.equal(n,6);});
 }finally{await f.close();}
});

test('SYNTHETIC_ONLY full backend path: new market scope needs its own licence/Source, obtains receipts, keeps retention0 and revokes', {skip:!process.env.SOURCE_HUB_TEST_ADMIN_URL},async()=>{
 const {fixture,U,A}=await import('./fixtures.mjs'),{createApplication}=await import('../src/server.mjs'),{sourceDefinition}=await import('../src/admission.mjs'),{createSourceHubClient}=await import('../../newsfeed-runtime/src/source-hub-client.mjs'),{readFileSync}=await import('node:fs'),{createHash,randomUUID}=await import('node:crypto');const f=await fixture();
 try{
  const app=createApplication({configuration:f.hub,repository:f.hubRepository,authorizer:f.hubAuthorizer,admission:f.admission,telemetry:{requestId:()=>randomUUID(),emit:()=>{}}}),client=createSourceHubClient(f.newsfeed,{fetchImpl:r=>app.handle(r)}),request=new Request(f.newsfeed.publicOrigin+'/operation',{headers:{authorization:'Bearer SYNTHETIC_A'}});
  const run=(criteria,key)=>client.acquire({request,command:q(criteria),context:{organisationId:A,expectedUserId:U},idempotencyKey:key});
  await assert.rejects(()=>run({mode:'snapshot'},'markets-before-admission'),{code:'LICENCE_ADMISSION_REQUIRED'});assert.equal(f.state.providerCalls.length,0);
  const d=sourceDefinition('trading-economics','market-observations'),policy=randomUUID();
  await f.admin(0,'profitia_ingestion_owner',async c=>{
   const sql=readFileSync(new URL('../../../packages/platform-contracts/migrations/access/029-market-symbol-transport.sql',import.meta.url),'utf8');await c.query(sql);await c.query("INSERT INTO profitia_external_market_symbol.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[createHash('sha256').update(sql).digest('hex')]);
   await c.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','source-hub-api-control-v1','TECHNICAL_CONTROL_NO_PRIVATE_DATA','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[d.sourceId]);
   await c.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),f.hub.sourceRole,d.sourceId,d.resourceId]);
   await c.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,'SOURCE_TRANSACTION',3000,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),f.hub.applicationId,d.sourceId]);
   await c.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,$5,$6,'HTTPS',$7::jsonb,16384,2097152,15000,'UPSTREAM_ATTEMPT_ADMISSION',1000,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[policy,f.hub.sourceRole,d.sourceId,d.resourceId,f.hub.configurationVersion,d.origin,JSON.stringify(d.pathRules)]);
   await c.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',2097152,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[policy,JSON.stringify(d.nativePathRules)]);
  });
  await f.admin(0,'source_hub_development_owner',async c=>{await c.query(readFileSync(new URL('../migrations/006-market-observations.sql',import.meta.url),'utf8'));await c.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at) VALUES('trading-economics','market-observations','SYNTHETIC_ONLY',1,$1,$2,$3,true,$4,0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',now()+interval '1 hour')",[d.sourceId,d.resourceId,policy,[f.newsfeed.applicationId]]);});
  const earlier=globalThis.fetch;globalThis.fetch=async(input,options)=>{const url=new URL(input instanceof Request?input.url:input);if(url.hostname!=='api.tradingeconomics.com'||!url.pathname.startsWith('/markets/'))return earlier(input,options);f.state.providerCalls.push({url:url.href,options});const response=Response.json(url.pathname==='/markets/commodities'?[{Symbol:'TEST:COM',Date:'2026-11-06T09:00:00',Last:0,Unit:'CNY/T',URL:'/commodity/synthetic'}]:[{Symbol:'TEST:COM',Date:'05/11/2026',Close:1}]);Object.defineProperty(response,'url',{value:url.href});return response;};
  const snapshot=await run({mode:'snapshot'},'markets-own-snapshot');assert.equal(snapshot.items[0].payload.price,0);assert.equal(snapshot.usage.upstreamAttempts,1);assert.match(snapshot.usage.receiptRef,/^[a-f0-9-]{36}$/);assert.equal(snapshot.items[0].metadata.retentionUntil,null);
  const history=await run({mode:'historical',symbols:['TEST:COM'],from:'2026-11-01',to:'2026-11-06'},'markets-own-history');assert.equal(history.items[0].payload.quoteBasis,'VENDOR_CLOSE');assert.equal(f.state.providerCalls.length,2);
  await assert.rejects(()=>run({mode:'snapshot'},'markets-own-snapshot'),{code:'RESULT_NOT_RETAINED'});assert.equal(f.state.providerCalls.length,2);
  await f.admin(0,'profitia_ingestion_owner',c=>c.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id=$1",[d.sourceId]));await assert.rejects(()=>run({mode:'snapshot'},'markets-after-revocation'),{code:'SOURCE_ADMISSION_REQUIRED'});assert.equal(f.state.providerCalls.length,2);
 }finally{await f.close();}
});
