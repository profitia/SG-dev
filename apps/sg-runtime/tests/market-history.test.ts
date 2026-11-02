import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import {validateProviderHistory,canonicalHistory,observationValue,historyDigest,readHistoryCommand,HISTORY_MAX_POINTS} from '../lib/market-data/history-contract'
import {createHistorySourceTransport,historySourcePolicy} from '../lib/market-data/history-source'
import {finderSourcePolicy} from '../lib/benchmark/discovery-source'
import {readMarketHistoryConfiguration} from '../lib/market-data/history-runtime'
import {observeMarketHistory} from '../lib/market-data/history-observability'
import {sanitizeError,sanitizeSpan,sanitizeTransaction} from '../lib/observability/sanitize'
import targets from '../deployment/market-history-targets.json'
const id='licensed_future_generic'
const raw=()=>[{metadata:{Name:id,Currency:'usd',DisplayUnit:'Currency Unit/Barrel',Frequency:'daily',FullDescription:'Actual licensed future',Source:'src_exchange'},dates:['2026-10-28','2026-10-29'],values:[-37.63,72.5]}]
const fake:any={$transaction:()=>assert.fail('Denied requests must never touch SQL'),$queryRawUnsafe:()=>assert.fail('No SQL for denied request')}
const options:any={prisma:fake,auditPrisma:{...fake},application:{appId:'spendguru-market-history',environment:'development'},binding:{applicationId:'spendguru-market-history',unmeteredSchemaDigest:'b'.repeat(64)},seriesId:id,operationKey:'a'.repeat(64),credentials:{clientId:'fixture-client',clientSecret:'fixture-secret'}}

test('full provider history is never silently truncated, coerced, sorted or substituted',()=>{
 assert.equal(validateProviderHistory(raw(),id).dates.length,2);assert.equal(observationValue(-37.63),-37.63)
 const cases=[(v:any)=>v[0].values.pop(),(v:any)=>v.push(v[0]),(v:any)=>v[0].metadata.Name='other',
  (v:any)=>v[0].dates.reverse(),(v:any)=>v[0].dates[1]=v[0].dates[0],(v:any)=>v[0].dates[1]='2026-02-31',
  (v:any)=>v[0].dates[1]='2099-01-01',(v:any)=>v[0].values[0]='12.3',(v:any)=>v[0].values[0]=Infinity,
  (v:any)=>v[0].values=[null,null],(v:any)=>v[0].values[0]=1.123456789,(v:any)=>v[0].values[0]=1e16,
  (v:any)=>{v[0].dates=Array(HISTORY_MAX_POINTS+1).fill('2026-10-28');v[0].values=Array(HISTORY_MAX_POINTS+1).fill(1)}]
 for(const change of cases){const v=raw();change(v);assert.throws(()=>validateProviderHistory(v,id))}
 const v=raw();v[0].values[0]=null as any;assert.doesNotThrow(()=>validateProviderHistory(v,id))
})
test('canonical metadata preserves provider identity, currency and numeric precision',()=>{
 const m=raw()[0].metadata,h:any={providerSeries:{provider:{providerCode:'MACROBOND',displayName:'Macrobond'},providerSeriesId:id,providerSeriesKey:id},displayName:id,frequency:'daily',currency:'usd',unit:'Currency Unit/Barrel',source:'src_exchange',historical:[{date:'2026-10-28T00:00:00.000Z',value:-37.63},{date:'2026-10-29T00:00:00.000Z',value:72.5}]}
 const c=canonicalHistory(id,h,m,2);assert.equal(c.currency,'USD');assert.equal(c.unit,'USD/Barrel');assert.equal(c.displayName,m.FullDescription)
 const command={schemaVersion:'1.0.0',runId:'durable-cycle-1',seriesId:id,history:c,metadata:m,historyFingerprint:historyDigest(c),acquisition:{callId:'7c7d5b1a-f38a-4ca6-aac8-1102ed953c62',responseSha256:'c'.repeat(64)}}
 assert.equal(readHistoryCommand(command).seriesId,id)
 assert.throws(()=>readHistoryCommand({...command,historyFingerprint:'0'.repeat(64)}))
 assert.throws(()=>canonicalHistory(id,h,m,3))
 assert.throws(()=>readHistoryCommand({...command,history:{...c,currency:'EUR'},historyFingerprint:historyDigest({...c,currency:'EUR'})}))
})
test('dedicated history boundary does not expand the Finder metadata boundary',()=>{
 assert(historySourcePolicy('API').basePathRules.some(r=>r.path==='/v1/series/fetchseries'))
 assert(!finderSourcePolicy('MACROBOND_API').basePathRules.some(r=>r.path==='/v1/series/fetchseries'))
 for(const r of historySourcePolicy('API').basePathRules)assert.equal(r.method,'POST')
 assert.throws(()=>createHistorySourceTransport({...options,application:{appId:'spendguru-benchmark-source'}}))
 assert.throws(()=>createHistorySourceTransport({...options,binding:{applicationId:'spendguru-market-history'}}))
})
test('history transport rejects arbitrary origins, paths, methods, credentials and inputs before SQL/HTTP',async()=>{
 const unavailable=(e:unknown)=>e instanceof Error&&e.name==='ExternalCallUnavailable'
 for(const [url,init] of [
  ['https://outside.invalid/v1/series/fetchseries',{method:'POST',body:'[]'}],
  ['https://api.macrobondfinancial.com/v1/search/entities',{method:'POST',body:'[]'}],
  ['https://api.macrobondfinancial.com/v1/series/fetchseries',{method:'GET'}],
  ['https://api.macrobondfinancial.com/v1/series/fetchseries?x=1',{method:'POST',body:'[]'}],
  ['https://apiauth.macrobondfinancial.com/mbauth/connect/token',{method:'POST',body:'grant_type=password'}],
  ['https://api.macrobondfinancial.com/v1/series/fetchseries',{method:'POST',body:JSON.stringify([{name:'different',dateEndOfPeriod:true}]),headers:{authorization:'Bearer unissued'}}],
 ] as const)await assert.rejects(createHistorySourceTransport(options).macrobond(url,init),unavailable)
 await assert.rejects(createHistorySourceTransport(options).macrobond(new Request('https://api.macrobondfinancial.com/v1/series/fetchseries')),unavailable)
 await assert.rejects(createHistorySourceTransport(options).openai('https://api.openai.com/v1/responses'),unavailable)
})
const env=()=>({PROFITIA_MARKET_HISTORY_ENABLED:'true',APP_ENV:'development',TARGET_ENVIRONMENT:'development',RENDER_SERVICE_ID:targets.serviceId,RENDER_GIT_COMMIT:'a'.repeat(40),PROFITIA_MARKET_HISTORY_CONFIGURATION_VERSION:targets.configurationVersion,PROFITIA_MARKET_HISTORY_DATABASE_URL:`postgresql://${targets.runtimeRole}:synthetic@${targets.hosts[0]}/${targets.databaseName}?sslmode=require`,MARKET_DATA_DATABASE_URL:`postgresql://${targets.read.runtimeRole}:synthetic@${targets.hosts[1]}/${targets.databaseName}?sslmode=require`,MACROBOND_CLIENT_ID:'fixture-client',MACROBOND_CLIENT_SECRET:'fixture-secret'})
test('runtime is disabled by default and accepts only exact Development service, branch host and ordinary roles',()=>{
 assert.equal(readMarketHistoryConfiguration({}),undefined);assert(readMarketHistoryConfiguration(env()))
 for(const patch of [{APP_ENV:'production'},{TARGET_ENVIRONMENT:'staging'},{RENDER_SERVICE_ID:'other'},{RENDER_GIT_COMMIT:'main'},{PROFITIA_MARKET_HISTORY_ENABLED:'yes'},{PROFITIA_MARKET_HISTORY_CONFIGURATION_VERSION:'other'},{MACROBOND_BASE_URL:'https://outside.invalid'},...[
  env().PROFITIA_MARKET_HISTORY_DATABASE_URL.replace(targets.runtimeRole,'neondb_owner'),env().PROFITIA_MARKET_HISTORY_DATABASE_URL.replace(targets.hosts[0],'localhost'),env().PROFITIA_MARKET_HISTORY_DATABASE_URL+'&options=-c%20role=admin',env().PROFITIA_MARKET_HISTORY_DATABASE_URL+'&sslmode=disable',env().PROFITIA_MARKET_HISTORY_DATABASE_URL+'&channel_binding=disable',env().PROFITIA_MARKET_HISTORY_DATABASE_URL+'#x',
 ].map(PROFITIA_MARKET_HISTORY_DATABASE_URL=>({PROFITIA_MARKET_HISTORY_DATABASE_URL}))])assert.throws(()=>readMarketHistoryConfiguration({...env(),...patch}))
})
test('candidate pins actual consumer and unchanged accepted producer SQL',()=>{
 const hash=(p:string)=>createHash('sha256').update(readFileSync(new URL(p,import.meta.url))).digest('hex')
 assert.equal(targets.boundaryDigest,hash('../prisma-market-data/private-write/003-market-history.sql'))
 assert.equal(targets.sourceSchemaDigest,hash('../../../packages/platform-contracts/migrations/access/008-platform-ingestion.sql'))
 assert.equal(targets.unmeteredSchemaDigest,hash('../../../packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql'))
 assert.equal(targets.quotaMode,'UNMETERED');assert.equal(targets.maximumConcurrentRefreshes,1)
})
test('real Sentry transport retains bounded stage/outcome/reason and suppresses raw financial data; failures never repeat work',async()=>{
 const sent:any[]=[]
 Sentry.init({dsn:`https://${'a'.repeat(32)}@o0.ingest.sentry.io/123`,defaultIntegrations:false,tracesSampleRate:1,beforeSend:sanitizeError,beforeSendSpan:sanitizeSpan,beforeSendTransaction:sanitizeTransaction,transport:()=>({send:async e=>{sent.push(e);return{statusCode:200}},flush:async()=>true})})
 let calls=0
 await Sentry.startSpan({name:'/api/market-data/hydrate',op:'http.server',forceTransaction:true},async()=>{
  assert.equal(await observeMarketHistory('PERSIST',async()=>{calls++;return 'accepted'}),'accepted')
  await assert.rejects(observeMarketHistory('PERSIST',async()=>{calls++;throw Error('PRIVATE_PRICE_AND_TOKEN_112233')}))
  await assert.rejects(observeMarketHistory('ACQUIRE',async()=>{calls++;const e=new Error('PRIVATE_DENIAL');e.name='OperationDenied';throw e}))
 })
 await Sentry.flush(2000);assert.equal(calls,3)
 const body=JSON.stringify(sent);assert(!body.includes('PRIVATE_PRICE_AND_TOKEN_112233'));assert(!body.includes('PRIVATE_DENIAL'))
 assert(body.includes('SOURCE_HISTORY_PERSIST'));assert(body.includes('market.history.outcome'));assert(body.includes('PERSISTENCE_UNAVAILABLE'))
 assert.equal(sent.flatMap(e=>e[1]).filter((i:any)=>i[0].type==='event').length,1,'one new persistence incident; expected denial is not an incident')
 Sentry.init({dsn:`https://${'a'.repeat(32)}@o0.ingest.sentry.io/123`,defaultIntegrations:false,tracesSampleRate:1,transport:()=>({send:async()=>{throw Error('Unavailable telemetry')},flush:async()=>false})})
 assert.equal(await observeMarketHistory('PERSIST',async()=>{calls++;return 9}),9);assert.equal(calls,4)
 await Sentry.close(100)
})
