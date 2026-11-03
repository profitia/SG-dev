import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createNewsApiProvider,DiscoveryError,prepareSearch,preparePublishers} from '../src/newsapi.mjs';
import {businessTerms,compileTerms} from '../src/query.mjs';

const key = 'test-only-secret-must-never-appear';
const rawArticle = {source:{id:null,name:'Example'},author:null,title:'Construction',description:null,url:'https://example.org/news',urlToImage:null,publishedAt:'2026-11-01T12:00:00Z',content:'Preview only [+1000 chars]'};
const response = payload => new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
function fixture(payload={status:'ok',totalResults:1,articles:[rawArticle]}, options={}) {
  const calls = [], events = [];
  const provider = createNewsApiProvider({apiKey:key,targetEnvironment:'development',fetchImpl:async(url,init)=>{calls.push({url,init});return response(payload);},onEvent:e=>events.push(e),...options});
  return {provider,calls,events};
}
const denied = (fn,code) => assert.throws(fn,e=>e instanceof DiscoveryError&&e.code===code);

test('neutral company, Boolean and exclusion criteria compile without provider names',()=>{
  const terms=businessTerms({subject:'Budimex',eventTypes:['contracts','investments']});
  const p=prepareSearch({mode:'articles',terms,fields:['headline','summary'],publishedAfter:'2026-10-26',publishedBefore:'2026-11-02',order:'newest',pageSize:5});
  assert.match(p.params.get('q'),/^"Budimex" AND \(/); assert.match(p.params.get('q'),/"investment"/);
  assert.equal(p.params.get('searchIn'),'title,description');assert.equal(p.params.get('sortBy'),'publishedAt');assert.equal(p.params.get('from'),'2026-10-26');
  assert.equal(compileTerms({all:['construction'],any:['rail','road'],phrases:['Acme Limited'],excluded:['sport']}),'"construction" AND "Acme Limited" AND ("rail" OR "road") AND NOT "sport"');
});
test('AND OR NOT, plus/minus and quoted text are encoded as one query parameter',()=>{
  const value='+construction AND (road OR rail) NOT sport -football "Acme Limited"';
  const p=prepareSearch({mode:'articles',text:value});assert.equal(new URL('https://example.org/?'+p.params).searchParams.get('q'),value);assert.equal([...p.params.keys()].includes('apiKey'),false);
});
test('all three documented sort choices map; page boundaries and search fields map',()=>{
  for(const [order,expected] of [['newest','publishedAt'],['relevance','relevancy'],['publisherPopularity','popularity']])assert.equal(prepareSearch({mode:'articles',text:'x',order}).params.get('sortBy'),expected);
  assert.equal(prepareSearch({mode:'articles',text:'x',fields:['body'],page:2,pageSize:100}).params.get('searchIn'),'content');
  assert.equal(prepareSearch({mode:'headlines',category:'business',editionCountry:'us'}).pageSize,20);
});
test('unsupported language, geography and article category fail before network',async()=>{
  const f=fixture();
  for(const query of [{mode:'articles',text:'x',language:'pl'},{mode:'articles',text:'x',category:'business'},{mode:'articles',text:'x',editionCountry:'pl'},{mode:'headlines',editionCountry:'pl'},{mode:'articles',text:'inwestycje',eventLocation:{region:'Mazowieckie'}}])await assert.rejects(f.provider.search(query),e=>e.code==='UNSUPPORTED_CRITERIA');
  assert.equal(f.calls.length,0);
});
test('headlines reject conflicting publisher/edition/category and unsupported date/sort/language',()=>{
  for(const field of ['editionCountry','category'])denied(()=>prepareSearch({mode:'headlines',publisherIds:['bbc-news'],[field]:field==='category'?'business':'us'}),'INCOMPATIBLE_CRITERIA');
  for(const [field,value]of [['publishedAfter','2026-11-01'],['order','newest'],['language','en'],['fields',['headline']],['domains',['example.org']],['terms',{all:['x']}]] )denied(()=>prepareSearch({mode:'headlines',text:'x',[field]:value}),'UNSUPPORTED_CRITERIA');
});
test('sources category, language and publisher country can combine; no catalogue pagination invented',()=>{
  const p=preparePublishers({category:'business',language:'en',publisherCountry:'pl'});assert.equal(p.get('country'),'pl');assert.equal(p.get('category'),'business');
  denied(()=>preparePublishers({page:1}),'UNKNOWN_CRITERIA');
  denied(()=>preparePublishers({language:'pl'}),'UNSUPPORTED_CRITERIA');
});
test('advanced expression grammar is rejected for headlines rather than silently treated as ordinary words',()=>{
  for(const text of ['rail AND road','+rail -sport','"Acme Limited"','rail OR (road NOT sport)'])denied(()=>prepareSearch({mode:'headlines',text}),'UNSUPPORTED_CRITERIA');
  assert.equal(prepareSearch({mode:'headlines',text:'Acme Limited'}).params.get('q'),'Acme Limited');
});
test('query validation rejects unknown fields, invalid domains, excessive sources, oversize expression and malformed dates',()=>{
  const bad=[{country:'pl'},{domains:['https://example.org']},{publisherIds:Array.from({length:21},(_,i)=>'source-'+i)},{text:'x'.repeat(501)},{publishedAfter:'2026-02-30'},{publishedAfter:'2026-11-02',publishedBefore:'2026-11-01'},{page:0},{page:1.5},{pageSize:101},{domains:['example.org'],excludedDomains:['example.org']},{fields:['unknown']},{terms:{any:['a" OR b']}},{terms:{unknown:['x']}},{text:null},{terms:[]}];
  for(const extra of bad)assert.throws(()=>prepareSearch({mode:'articles',text:'x',...extra}),DiscoveryError);
  denied(()=>prepareSearch({mode:'articles'}),'MISSING_CRITERIA');
});
test('HTTP request uses only fixed HTTPS origin, a header key, no redirect, exactly one call',async()=>{
  const f=fixture();const r=await f.provider.search({mode:'articles',text:'Budimex & rail',pageSize:3});
  assert.equal(r.status,'ok');assert.equal(f.calls.length,1);
  const {url,init}=f.calls[0];assert.equal(new URL(url).origin,'https://newsapi.org');assert.equal(new URL(url).pathname,'/v2/everything');assert.equal(url.includes(key),false);assert.equal(init.headers['X-Api-Key'],key);assert.equal(init.redirect,'error');
  assert.equal(JSON.stringify(f.provider).includes(key),false);
});
test('article provenance is neutral and missing language/category/event geography remain null',async()=>{
  const {provider}=fixture();const r=await provider.search({mode:'articles',text:'x',language:'en'});
  assert.equal(r.contractVersion,'0.1.0');assert.equal(r.items[0].publisher.id,null);assert.equal(r.items[0].language,null);assert.equal(r.items[0].category,null);assert.equal(r.items[0].eventLocation,null);assert.equal(r.items[0].provenance.fullTextAvailable,false);assert.equal(r.items[0].bodyPreview,rawArticle.content);assert.equal(r.items[0].discoveredAt,r.observedAt);
});
test('successful empty results are not plan or filter failures',async()=>{
  const f=fixture({status:'ok',totalResults:0,articles:[]});assert.equal((await f.provider.search({mode:'articles',text:'unlikely'})).status,'empty');assert.equal(f.events[0].outcome,'empty');
});
test('publisher metadata is returned separately and never used as event location',async()=>{
  const f=fixture({status:'ok',sources:[{id:'bbc-news',name:'BBC',url:'https://bbc.co.uk',description:null,category:'general',language:'en',country:'gb'}]});
  const r=await f.provider.listPublishers({publisherCountry:'gb'});assert.equal(r.items[0].publisherCountry,'gb');assert.equal('eventLocation' in r.items[0],false);assert.equal(new URL(f.calls[0].url).pathname,'/v2/top-headlines/sources');
});
test('headlines use their endpoint without inventing article-level category metadata',async()=>{
  const f=fixture();const r=await f.provider.search({mode:'headlines',category:'business',editionCountry:'us'});assert.equal(new URL(f.calls[0].url).pathname,'/v2/top-headlines');assert.equal(r.items[0].category,null);
});
for(const [status,code,expected] of [[401,'apiKeyInvalid','AUTHENTICATION_FAILED'],[429,'apiKeyExhausted','QUOTA_EXHAUSTED'],[429,'rateLimited','RATE_LIMITED'],[426,'unknown','PLAN_RESTRICTED'],[400,'parameterInvalid','PROVIDER_REJECTED_CRITERIA'],[400,'maximumResultsReached','PLAN_LIMIT'],[426,'maximumResultsReached','PLAN_LIMIT'],[503,'unexpectedError','PROVIDER_UNAVAILABLE']]){
  test('sanitized provider error '+expected+' HTTP'+status+' is distinct and never retried',async()=>{
    let calls=0;const events=[];const p=createNewsApiProvider({apiKey:key,targetEnvironment:'development',onEvent:e=>events.push(e),fetchImpl:async()=>{calls++;return new Response(JSON.stringify({status:'error',code,message:'raw '+key}),{status,headers:{'retry-after':'60'}});}});
    await assert.rejects(p.search({mode:'articles',text:'private search'}),e=>{assert.equal(e.code,expected);assert.equal(e.retryAfterSeconds,60);assert.equal(JSON.stringify(e).includes(key),false);return true;});
    assert.equal(calls,1);assert.equal(JSON.stringify(events).includes(key),false);assert.equal(JSON.stringify(events).includes('private search'),false);
  });
}
test('network error messages cannot expose request headers, key or raw query',async()=>{
  const f=fixture(undefined,{fetchImpl:async()=>{throw new Error('header '+key+' private search');}});
  await assert.rejects(f.provider.search({mode:'articles',text:'private search'}),e=>e.code==='NETWORK_ERROR'&&!JSON.stringify(e).includes(key));assert.equal(JSON.stringify(f.events).includes('private search'),false);
});
test('non-JSON rate limit remains a rate limit and invalid success retains HTTP status',async()=>{
  const limited=fixture(undefined,{fetchImpl:async()=>new Response('upstream '+key,{status:429})});await assert.rejects(limited.provider.search({mode:'articles',text:'x'}),e=>e.code==='RATE_LIMITED'&&e.httpStatus===429&&!JSON.stringify(e).includes(key));
  const invalid=fixture({status:'ok',totalResults:0,articles:[rawArticle]});await assert.rejects(invalid.provider.search({mode:'articles',text:'x'}),e=>e.code==='INVALID_RESPONSE'&&e.httpStatus===200);
});
test('in-flight query mutation cannot alter normalized provenance or operation identity',async()=>{
  let release;const ready=new Promise(resolve=>{release=resolve;});
  const f=fixture(undefined,{fetchImpl:async()=>{await ready;return response({status:'ok',totalResults:1,articles:[rawArticle]});}});
  const query={mode:'articles',text:'x'};const pending=f.provider.search(query);query.mode='headlines';release();const result=await pending;assert.equal(result.mode,'articles');assert.equal(result.items[0].provenance.mode,'articles');
});
test('CLI plan validates unsupported filters without a key or a provider call',()=>{
  const env={PATH:process.env.PATH};
  const valid=spawnSync(process.execPath,['src/cli.mjs','plan','examples/company.json'],{cwd:new URL('..',import.meta.url),encoding:'utf8',env});assert.equal(valid.status,0);assert.equal(JSON.parse(valid.stdout).networkRequestPerformed,false);
  const denied=spawnSync(process.execPath,['src/cli.mjs','plan','examples/industry.json'],{cwd:new URL('..',import.meta.url),encoding:'utf8',env});assert.equal(denied.status,1);assert.equal(JSON.parse(denied.stderr).code,'UNSUPPORTED_CRITERIA');
});
test('timeout is bounded, sanitized and performs no retry',async()=>{
  const f=fixture(undefined,{timeoutMs:5,fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error(key)));})});
  await assert.rejects(f.provider.search({mode:'articles',text:'x'}),e=>e.code==='TIMEOUT');
});
test('malformed bodies, URLs and schema are explicit errors, not fabricated empty success',async()=>{
  for(const payload of [{status:'ok',totalResults:1,articles:[{...rawArticle,url:'javascript:alert(1)'}]},{status:'ok',totalResults:'1',articles:[]},{status:'ok',sources:{}},{status:'ok',totalResults:1,articles:[{...rawArticle,publishedAt:'invalid'}]},null]){
    const f=fixture(payload);await assert.rejects(payload?.sources ? f.provider.listPublishers() : f.provider.search({mode:'articles',text:'x'}),e=>e.code==='INVALID_RESPONSE');
  }
  const f=fixture(undefined,{fetchImpl:async()=>new Response('not JSON')});await assert.rejects(f.provider.search({mode:'articles',text:'x'}),e=>e.code==='INVALID_RESPONSE');
});
test('oversize response is stopped before JSON normalization',async()=>{
  const f=fixture(undefined,{fetchImpl:async()=>new Response('x'.repeat(2*1024*1024+1))});await assert.rejects(f.provider.search({mode:'articles',text:'x'}),e=>e.code==='RESPONSE_TOO_LARGE');
});
test('telemetry callback failures do not fail discovery or leak payloads',async()=>{
  const f=fixture(undefined,{onEvent:async()=>{throw new Error(key);}});assert.equal((await f.provider.search({mode:'articles',text:'x'})).status,'ok');
});
test('capability snapshots cannot mutate future capability checks',()=>{
  const f=fixture();const a=f.provider.getCapabilities();a.headlines.editionCountry.push('pl');assert.deepEqual(f.provider.getCapabilities().headlines.editionCountry,['us']);denied(()=>prepareSearch({mode:'headlines',editionCountry:'pl'}),'UNSUPPORTED_CRITERIA');
});
test('production/staging and missing key cannot issue requests; capabilities need no secret',()=>{
  for(const targetEnvironment of ['production','staging',undefined])denied(()=>createNewsApiProvider({apiKey:key,targetEnvironment}),'DEVELOPMENT_ONLY');
  denied(()=>createNewsApiProvider({apiKey:'',targetEnvironment:'development'}),'INVALID_CONFIGURATION');
  const r=spawnSync(process.execPath,['src/cli.mjs','capabilities'],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{PATH:process.env.PATH}});assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).provider,'newsapi');
});
