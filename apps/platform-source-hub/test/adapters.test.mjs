import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBrave,createBraveProvider} from '../src/providers/brave.mjs';
import {prepareTradingEconomics,createTradingEconomicsProvider} from '../src/providers/trading-economics.mjs';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
const apiKey='synthetic-provider-key-no-live-access';
const instant='2026-11-03T10:00:00.000Z';
const fixture=payload=>{const calls=[];return {calls,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(payload);}};};
const te=(payload)=>{const f=fixture(payload);return {...f,provider:createTradingEconomicsProvider({...f,apiKey,now:()=>instant})};};
test('Brave maps Polish/international filters and page offsets as pages; operators remain explicit',()=>{
 const p=prepareBrave({text:'inwestycje',country:'pl',language:'pl',count:5,offset:2,freshness:'pw',domains:['example.pl','example.org'],excludedDomains:['sport.example.pl'],spellcheck:false});const u=new URL(p.url);
 assert.equal(u.origin,'https://api.search.brave.com');assert.equal(u.pathname,'/res/v1/web/search');assert.equal(u.searchParams.get('country'),'PL');assert.equal(u.searchParams.get('search_lang'),'pl');assert.equal(u.searchParams.get('offset'),'2');assert.match(u.searchParams.get('q'),/site:example.pl OR site:example.org/);assert.equal(u.searchParams.has('apiKey'),false);
});
test('Brave refuses unsupported fields, dates, countries, modes and news pagination before a call',()=>{
 for(const q of [{country:'ZZ'},{count:21},{offset:10},{freshness:'2026-02-30to2026-03-01'},{freshness:'2026-11-03to2026-11-01'},{eventLocation:'Poland'},{resultType:'news',offset:1},{resultType:'news',count:5},{language:'invented'},{domains:['https://example.org']},{domains:['example.org'],excludedDomains:['example.org']}])assert.throws(()=>prepareBrave({text:'x',...q}),SourceHubError);
});
test('Brave web pages preserve original URL and ambiguous page age without invented publication dates',async()=>{
 const f=fixture({type:'search',query:{more_results_available:true},web:{results:[{url:'https://example.pl/page?a=1',title:'Page',description:'Description',page_age:'2026-10-02',age:'one month',meta_url:{hostname:'example.pl'}}]}});
 const p=createBraveProvider({...f,apiKey,now:()=>instant});const r=await p.search({text:'x',country:'PL',language:'pl'});assert.equal(r.items[0].payload.kind,'WEB_PAGE');assert.equal(r.items[0].payload.publishedAt,null);assert.equal(r.items[0].payload.modifiedAt,null);assert.equal(r.items[0].payload.providerDateMetadata.pageAge,'2026-10-02');assert.equal(r.items[0].payload.eventGeography,null);assert.equal(r.items[0].payload.url,'https://example.pl/page?a=1');assert.equal(f.calls[0].options.headers['X-Subscription-Token'],apiKey);assert.equal(r.page.more,true);
});
test('Brave native news cluster has no invented web pagination; absent entitlement is not an empty success',async()=>{
 const f=fixture({type:'search',query:{more_results_available:true},news:{results:[]}});const r=await createBraveProvider({...f,apiKey}).search({text:'x',resultType:'news'});assert.equal(r.status,'empty');assert.equal(r.page.page,null);assert.equal(r.page.more,null);
 const missing=createBraveProvider({...fixture({type:'search',query:{}}),apiKey});await assert.rejects(missing.search({text:'x',resultType:'news'}),e=>e.code==='CAPABILITY_NOT_CONFIRMED');
});
test('Brave domain constraints validate returned hosts in addition to experimental query operators',async()=>{
 const f=fixture({type:'search',query:{},web:{results:[{url:'https://example.pl/a'},{url:'https://sport.example.pl/b'},{url:'https://fakeexample.pl/c'}]}});const r=await createBraveProvider({...f,apiKey}).search({text:'x',domains:['example.pl'],excludedDomains:['sport.example.pl']});assert.equal(r.items.length,1);assert.equal(r.items[0].payload.url,'https://example.pl/a');
});
test('TE calendar keeps actual, consensus, TE projection and previous/revised semantics separate',async()=>{
 const row={CalendarId:'123',Date:'2026-11-04T10:00:00',Country:'Poland',Category:'Inflation Rate',Event:'Inflation Rate YoY',Actual:'',Forecast:'3%',TEForecast:'4%',Previous:'2.5%',Revised:'2.7%',DateSpan:'1',Importance:3,LastUpdate:'2026-11-03T08:00:00',Source:'Statistics',SourceURL:'https://example.org',Reference:'Oct',Unit:'%',Currency:''};const f=te([row]);const r=await f.provider.search('economic-calendar',{countries:['poland'],from:'2026-11-01',to:'2026-11-05',importance:3});const x=r.items[0].payload;
 assert.equal(x.actual,null);assert.equal(x.releaseStatus,'SCHEDULED');assert.equal(x.temporalPosition,'FUTURE');assert.equal(x.eventTimezone,'UTC');assert.equal(x.dateSpan,1);assert.equal(x.consensusForecast,'3%');assert.equal(x.vendorForecast,'4%');assert.equal(x.previous,'2.5%');assert.equal(x.revised,'2.7%');assert.equal(x.native.Revised,row.Revised);assert.equal(x.lastUpdate,'2026-11-03T08:00:00.000Z');assert.equal(f.calls[0].options.headers.Authorization,apiKey);assert.equal(f.calls[0].url.includes(apiKey),false);
});
test('TE zero is a result; missing actual on a past release stays unknown',async()=>{
 for(const [value,status]of [[0,'REPORTED'],['0','REPORTED'],[null,'UNKNOWN'],['null','UNKNOWN']]){const f=te([{CalendarId:'1',Date:'2026-10-01T10:00:00',Actual:value}]);const r=await f.provider.search('economic-calendar',{});assert.equal(r.items[0].payload.releaseStatus,status);assert.equal(r.items[0].payload.temporalPosition,'PAST');}
});
test('TE filters use documented paths and explicitly local event/category projection',()=>{
 assert.equal(new URL(prepareTradingEconomics('economic-calendar',{countries:['poland'],indicators:['inflation rate']}).url).pathname,'/calendar/country/poland/indicator/inflation%20rate');
 assert.equal(new URL(prepareTradingEconomics('indicators',{indicators:['gdp']}).url).pathname,'/country/all/gdp');
 assert.equal(new URL(prepareTradingEconomics('indicators',{tickers:['USURTOT']}).url).pathname,'/country/ticker/USURTOT');
 assert.equal(new URL(prepareTradingEconomics('external-forecasts',{countries:['poland'],indicators:['gdp']}).url).pathname,'/forecast/country/poland/indicator/gdp');
 for(const c of [{countries:['poland'],tickers:['x']},{countries:['../../owner']},{countries:['poland'],offset:3},{countries:['poland'],horizons:['invented']}])assert.throws(()=>prepareTradingEconomics('external-forecasts',c),SourceHubError);
});
test('TE indicator reference period, update time and missing values remain distinct',async()=>{
 const f=te([{Country:'Poland',Category:'GDP',HistoricalDataSymbol:'PLGDP',LatestValue:null,LatestValueDate:'2025-12-31T00:00:00',LastUpdate:'2026-10-01T12:00:00',Unit:'USD Billion',Frequency:'Yearly'}]);const r=await f.provider.search('indicators',{countries:['poland'],indicators:['GDP']});const x=r.items[0].payload;assert.equal(x.value,null);assert.equal(x.referencePeriod,'2025-12-31T00:00:00');assert.equal(x.lastUpdate,'2026-10-01T12:00:00.000Z');assert.equal(r.provenance.retrievedAt,instant);assert.equal(x.unit,'USD Billion');assert.equal(x.frequency,'Yearly');
});
test('TE external forecasts preserve native horizons/vintage and never become Forecast Core predictions',async()=>{
 const f=te([{Country:'Poland',Category:'GDP',LatestValue:900,LatestValueDate:'2025-12-31T00:00:00',q1:920,q1_date:'2026-12-31T00:00:00',q2:null,YearEnd:930,ForecastLastUpdate:'2026-10-01T12:00:00',Unit:'USD Billion'}]);const r=await f.provider.search('external-forecasts',{countries:['poland'],horizons:['q1','q2','YearEnd']});const x=r.items[0].payload;assert.equal(x.forecastCorePrediction,false);assert.equal(x.historical.value,900);assert.equal(x.points[0].value,920);assert.equal(x.points[0].targetDate,'2026-12-31T00:00:00');assert.equal(x.points[1].value,null);assert.equal(x.points[2].targetDate,null);assert.equal(x.lastUpdate,'2026-10-01T12:00:00.000Z');
});
test('TE local projection/truncation is explicit and never claims native pagination',async()=>{
 const f=te([{Country:'Poland',Category:'GDP',LatestValue:1},{Country:'Poland',Category:'Inflation',LatestValue:2}]);const r=await f.provider.search('indicators',{countries:['poland'],limit:1});assert.equal(r.page.truncated,true);assert.equal(r.page.more,true);assert.equal(r.page.total,null);assert.equal(r.coverage.providerReturned,2);assert.equal(r.coverage.completeness,'INCOMPLETE');assert.equal(r.items.length,1);
});
test('provider errors, redirects, malformed success and oversized bodies are sanitized without retry',async()=>{
 for(const [status,expected]of [[401,'AUTHENTICATION_FAILED'],[403,'PROVIDER_FORBIDDEN'],[429,'RATE_LIMITED'],[503,'PROVIDER_UNAVAILABLE']]){let count=0;const p=createTradingEconomicsProvider({apiKey,fetchImpl:async()=>{count++;return new Response('raw '+apiKey,{status,headers:{'retry-after':'2'}});}});await assert.rejects(p.search('indicators',{countries:['poland']}),e=>e.code===expected&&!JSON.stringify(e).includes(apiKey));assert.equal(count,1);}
 const malformed=te({error:'sensitive'});await assert.rejects(malformed.provider.search('indicators',{countries:['poland']}),e=>e.code==='INVALID_RESPONSE');
 const large=createTradingEconomicsProvider({apiKey,fetchImpl:async()=>new Response('a'.repeat(2*1024*1024+1))});await assert.rejects(large.search('indicators',{countries:['poland']}),e=>e.code==='RESPONSE_TOO_LARGE');
});
test('TE News selects documented native routes and rejects unverified combinations',()=>{
 const p=prepareTradingEconomics('news-discovery',{newsType:'markets',from:'2026-11-01',to:'2026-11-04',text:'oil',limit:2}),u=new URL(p.url);
 assert.equal(u.pathname,'/news');assert.equal(u.searchParams.get('type'),'markets');assert.equal(u.searchParams.get('d1'),'2026-11-01');assert.equal(u.searchParams.get('d2'),'2026-11-04');assert.equal(u.searchParams.has('text'),false);assert.deepEqual(p.localFilters,['text','limit']);
 assert.equal(new URL(prepareTradingEconomics('news-discovery',{countries:['United States'],indicators:['Crude Oil']}).url).pathname,'/news/country/United%20States/Crude%20Oil');
 assert.equal(new URL(prepareTradingEconomics('news-discovery',{indicators:['Crude Oil']}).url).pathname,'/news/indicator/Crude%20Oil');
 assert.equal(new URL(prepareTradingEconomics('news-discovery',{tickers:['CL1']}).url).pathname,'/news/ticker/CL1');
 for(const c of [{newsType:'invented'},{newsType:'markets',countries:['Poland']},{tickers:['x'],indicators:['gdp']},{tickers:['x'],from:'2026-11-01',to:'2026-11-04'},{from:'2026-11-01'},{countries:['%2Fadmin']},{tickers:['../private']},{limit:1001},{text:''},{eventLocation:'Poland'}])assert.throws(()=>prepareTradingEconomics('news-discovery',c),SourceHubError);
});
test('TE News preserves identity, UTC and commentary metadata without claiming local filtering covers all news',async()=>{
 const row={id:'100',title:'Oil outlook',description:'OPEC supply',date:'2026-11-03T09:00:00',country:'United States',category:'Crude Oil',symbol:'CL1',url:'/commodity/crude-oil',importance:0};
 const f=te([row,{...row,id:'101',title:'Other market',description:'Other topic'}]),r=await f.provider.search('news-discovery',{newsType:'markets',text:'oil'}),item=r.items[0];
 assert.equal(r.items.length,1);assert.equal(item.metadata.vendorRecordId,'100');assert.equal(item.payload.publishedAt,'2026-11-03T09:00:00.000Z');assert.equal(item.payload.commentary.country,'United States');assert.equal(item.payload.commentary.importance,0);assert.equal(item.payload.commentary.type,null);assert.equal(item.payload.publisherCountry,null);assert.equal(item.payload.eventGeography,null);assert.equal(item.payload.url,'https://tradingeconomics.com/commodity/crude-oil');assert.equal(item.payload.native.description,row.description);assert.equal(r.page.total,null);assert.equal(r.page.more,null);assert.equal(r.coverage.completeness,'UNKNOWN');assert.equal(r.coverage.providerReturned,2);assert.equal(r.coverage.matchedLocally,1);assert.equal(f.calls.length,1);
 const upper=Object.fromEntries(Object.entries(row).map(([k,v])=>[k[0].toUpperCase()+k.slice(1),v]));assert.equal((await te([upper]).provider.search('news-discovery',{})).items[0].metadata.vendorRecordId,'100');
});
test('TE News rejects malformed identity, importance and unsafe URLs instead of publishing a bare HTTP200',async()=>{
 const row={id:'1',title:'News',url:'/commodity/crude-oil'};
 for(const patch of [{id:null},{importance:4},{url:'javascript:alert(1)'},{url:'https://user:pass@example.org/'},{url:42},{date:'yesterday'}])await assert.rejects(te([{...row,...patch}]).provider.search('news-discovery',{}),e=>e.code==='INVALID_RESPONSE');
 const empty=await te([]).provider.search('news-discovery',{});assert.equal(empty.status,'empty');assert.equal(empty.page.total,null);assert.equal(empty.coverage.completeness,'UNKNOWN');
});
test('TE Markets uses a separate explicit forecast selector and preserves vendor horizons and unadopted instrument identity',async()=>{
 const plan=prepareTradingEconomics('external-forecasts',{forecastType:'markets',marketCategory:'commodity',symbols:['CO1:COM','CL1:COM']}),u=new URL(plan.url);assert.equal(u.pathname,'/markets/forecasts/commodity');assert.deepEqual(plan.localFilters,['symbols']);
 assert.equal(new URL(prepareTradingEconomics('external-forecasts',{forecastType:'markets',marketCategory:'commodity'}).url).pathname,'/markets/forecasts/commodity');
 for(const c of [{forecastType:'markets'},{forecastType:'markets',symbols:['CO1:COM']},{forecastType:'markets',marketCategory:'commodity',symbols:['../owner']},{forecastType:'markets',symbols:['CO1:COM'],countries:['World']},{forecastType:'markets',marketCategory:'oil'}])assert.throws(()=>prepareTradingEconomics('external-forecasts',c),SourceHubError);
 const f=te([{Symbol:'CO1:COM',Country:'World',Date:'2026-11-03T09:00:00',Type:'commodity',Last:0,Unit:'USD/bbl',URL:'/commodity/brent-crude-oil',Forecast1:71,ForecastDate1:'2026-12-31',Forecast2:null}]);
 const r=await f.provider.search('external-forecasts',{forecastType:'markets',marketCategory:'commodity',symbols:['CO1:COM']}),x=r.items[0];assert.equal(x.metadata.endpointVersion,'markets/forecasts');assert.equal(x.payload.historical.value,0);assert.equal(x.payload.historical.referencePeriod,'2026-11-03T09:00:00');assert.equal(x.payload.points[0].value,71);assert.equal(x.payload.points[0].targetDate,'2026-12-31');assert.equal(x.payload.points[1].value,null);assert.equal(x.payload.lastUpdate,null);assert.equal(x.payload.instrumentMappingStatus,'NOT_ADOPTED_BY_MARKET_DATA');assert.equal(x.payload.forecastCorePrediction,false);assert.equal(x.payload.unit,'USD/bbl');assert.equal(x.metadata.asOf,null);
});
test('Brave explicitly enables experimental operators and reports query alteration without promoting acceptance to verification',async()=>{
 const q='"crude oil" AND (OPEC OR asphalt) NOT sports';assert.equal(new URL(prepareBrave({text:q}).url).searchParams.get('q'),q);assert.equal(new URL(prepareBrave({text:q}).url).searchParams.get('operators'),'true');
 const f=fixture({type:'search',query:{original:q,altered:'oil'},web:{results:[]}}),r=await createBraveProvider({...f,apiKey}).search({text:q});assert.equal(r.status,'empty');assert.equal(r.coverage.operatorSemantics,'EXPERIMENTAL_UNVERIFIED');assert.equal(r.coverage.providerQueryAltered,true);assert.equal(r.coverage.completeness,'UNKNOWN');assert.equal(JSON.stringify(r).includes(q),false);
});
