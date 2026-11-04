import {fields,text,list,integer,day,optionalText,scalar,url,providerUtc,providerJson,credential,record,result,fail} from '../transport.mjs';
export const TE_ORIGIN='https://api.tradingeconomics.com';
const horizons=['q1','q2','q3','q4','YearEnd','YearEnd2','YearEnd3'];
function names(value,max=10){return list(value,max).map(v=>{if(!/^[\p{L}\p{N} ._()+%&='-]+$/u.test(v)||v.includes('..')||/%[a-f0-9]{2}/i.test(v))fail();return v;});}
const pathPart=values=>values.map(encodeURIComponent).join(',');
function symbols(value){return list(value,10).map(v=>{if(!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,79}$/.test(v)||v.includes('..'))fail();return v;});}
function dateRange(c,p){
 if((c.from===undefined)!==(c.to===undefined))fail('INCOMPATIBLE_CRITERIA');
 if(c.from!==undefined){const from=day(c.from),to=day(c.to);if(from>to||Date.parse(to)-Date.parse(from)>366*86400000)fail();p.set('d1',from);p.set('d2',to);}
}
function newsPlan(criteria){
 fields(criteria,['countries','indicators','tickers','newsType','from','to','text','limit']);
 const c=structuredClone(criteria),countries=c.countries===undefined?null:names(c.countries),indicators=c.indicators===undefined?null:names(c.indicators),tickers=c.tickers===undefined?null:names(c.tickers);
 if(tickers&&(countries||indicators))fail('INCOMPATIBLE_CRITERIA');
 // Type is documented independently; do not promise unverified combinations.
 if(c.newsType!==undefined&&(!['markets','economy'].includes(c.newsType)||countries||indicators||tickers))fail('UNSUPPORTED_CRITERIA');
 const p=new URLSearchParams({f:'json'});dateRange(c,p);
 if(tickers&&(c.from!==undefined))fail('UNSUPPORTED_CRITERIA');
 if(c.newsType!==undefined)p.set('type',c.newsType);
 const path=tickers?'/news/ticker/'+pathPart(tickers):countries?'/news/country/'+pathPart(countries)+(indicators?'/'+pathPart(indicators):''):indicators?'/news/indicator/'+pathPart(indicators):'/news';
 if(path.length>1024)fail('CRITERIA_TOO_LARGE');
 return {url:TE_ORIGIN+path+'?'+p,limit:integer(c.limit??100,1,1000),localText:c.text===undefined?null:text(c.text,200),localIndicators:null,eventText:null,
  nativeFilters:Object.keys(c).filter(k=>!['limit','text'].includes(k)),localFilters:Object.keys(c).filter(k=>['limit','text'].includes(k)),market:false};
}
function marketForecastPlan(criteria){
 fields(criteria,['forecastType','symbols','marketCategory','limit']);
 const path=['index','currency','crypto','commodity','bond'].includes(criteria.marketCategory)?'/markets/forecasts/'+criteria.marketCategory:null;
 if(!path)fail('UNSUPPORTED_CRITERIA');
 if(path.length>1024)fail('CRITERIA_TOO_LARGE');
 return {url:TE_ORIGIN+path+'?f=json',limit:integer(criteria.limit??100,1,1000),localIndicators:null,eventText:null,market:true,localSymbols:criteria.symbols===undefined?null:symbols(criteria.symbols),
  nativeFilters:['marketCategory'],localFilters:Object.keys(criteria).filter(k=>['limit','symbols'].includes(k))};
}
export function prepareTradingEconomics(family,criteria){
 if(family==='news-discovery')return newsPlan(criteria);
 if(family==='external-forecasts'&&criteria?.forecastType==='markets')return marketForecastPlan(criteria);
 if(!['economic-calendar','indicators','external-forecasts'].includes(family))fail('UNSUPPORTED_FAMILY');
 const allowed=['countries','indicators','tickers','limit',...(family==='economic-calendar'?['eventIds','from','to','importance','eventText']:family==='external-forecasts'?['horizons']:[])];fields(criteria,allowed);
 const c=structuredClone(criteria),countries=c.countries===undefined?null:names(c.countries),indicators=c.indicators===undefined?null:names(c.indicators),tickers=c.tickers===undefined?null:names(c.tickers);
 if(tickers&&(countries||indicators||c.eventIds))fail('INCOMPATIBLE_CRITERIA');
 const limit=integer(c.limit??100,1,1000),p=new URLSearchParams({f:'json'});let path,localIndicators=null;
 if(family==='economic-calendar'){
  if(c.eventIds){if(countries||indicators||tickers||c.from||c.to||c.importance||c.eventText)fail('INCOMPATIBLE_CRITERIA');const ids=list(c.eventIds,20);if(ids.some(v=>!/^\d{1,20}$/.test(v)))fail();path='/calendar/calendarid/'+ids.join(',');}
  else if(tickers){if(c.from||c.to)fail('UNSUPPORTED_CRITERIA');path='/calendar/ticker/'+pathPart(tickers);}
  else path='/calendar'+(countries?'/country/'+pathPart(countries):indicators?'/indicator/'+pathPart(indicators):'')+(countries&&indicators?'/indicator/'+pathPart(indicators):'');
  if((c.from===undefined)!==(c.to===undefined))fail('INCOMPATIBLE_CRITERIA');
  if(c.from!==undefined){const from=day(c.from),to=day(c.to);if(from>to||Date.parse(to)-Date.parse(from)>366*86400000)fail();if(path==='/calendar')path+='/country/All';path+='/'+from+'/'+to;}
  if(c.importance!==undefined)p.set('importance',String(integer(c.importance,1,3)));
  if(c.eventText!==undefined)text(c.eventText,200);
 }else if(family==='indicators'){
  if(tickers)path='/country/ticker/'+pathPart(tickers);
  else if(countries){path='/country/'+pathPart(countries);localIndicators=indicators;}
  else if(indicators){if(indicators.length!==1)fail('UNSUPPORTED_CRITERIA');path='/country/all/'+pathPart(indicators);}
  else fail('MISSING_CRITERIA');
 }else{
  if(tickers)path='/forecast/ticker/'+pathPart(tickers);
  else if(countries)path='/forecast/country/'+pathPart(countries)+(indicators?'/indicator/'+pathPart(indicators):'');
  else if(indicators)path='/forecast/indicator/'+pathPart(indicators);else fail('MISSING_CRITERIA');
  if(c.horizons!==undefined&&list(c.horizons,7).some(v=>!horizons.includes(v)))fail('UNSUPPORTED_CRITERIA');
 }
 if(path.length>1024)fail('CRITERIA_TOO_LARGE');
 return {url:TE_ORIGIN+path+'?'+p,limit,localIndicators,eventText:c.eventText??null,horizons:c.horizons??horizons,market:false,
  nativeFilters:Object.keys(c).filter(k=>!['limit','horizons','eventText',...(localIndicators?['indicators']:[])].includes(k)),
  localFilters:Object.keys(c).filter(k=>['limit','horizons','eventText',...(localIndicators?['indicators']:[])].includes(k))};
}
const pick=(raw,keys)=>Object.fromEntries(keys.filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]]));
function teUrl(value,required=false){
 if(value===null||value===undefined||value==='')return url(null,required);
 if(typeof value!=='string')fail('INVALID_RESPONSE',502);
 try{return url(new URL(value,'https://tradingeconomics.com').href,required);}catch{fail('INVALID_RESPONSE',502);}
}
function calendar(raw,retrievedAt){
 const eventId=optionalText(raw.CalendarId??raw.CalendarID);if(!eventId)fail('INVALID_RESPONSE',502);
 const actual=scalar(raw.Actual),eventAt=providerUtc(raw.Date),span=raw.DateSpan===undefined||raw.DateSpan===null||raw.DateSpan===''?null:Number(raw.DateSpan);
 if(span!==null&&![0,1].includes(span))fail('INVALID_RESPONSE',502);
 const temporalPosition=eventAt===null?'UNKNOWN':Date.parse(eventAt)>Date.parse(retrievedAt)?'FUTURE':'PAST';
 const importance=raw.Importance===undefined||raw.Importance===null||raw.Importance===''?null:Number(raw.Importance);if(importance!==null&&![1,2,3].includes(importance))fail('INVALID_RESPONSE',502);
 const payload={eventId,eventAt,eventTimezone:eventAt?'UTC':null,country:optionalText(raw.Country),indicator:optionalText(raw.Category),event:optionalText(raw.Event),actual,
  consensusForecast:scalar(raw.Forecast),vendorForecast:scalar(raw.TEForecast),previous:scalar(raw.Previous),revised:scalar(raw.Revised),dateSpan:span,importance,
  lastUpdate:providerUtc(raw.LastUpdate),referencePeriod:optionalText(raw.ReferenceDate)||optionalText(raw.Reference),unit:optionalText(raw.Unit),currency:optionalText(raw.Currency),
  releaseStatus:actual!==null?'REPORTED':temporalPosition==='FUTURE'?'SCHEDULED':'UNKNOWN',temporalPosition,source:optionalText(raw.Source),sourceUrl:url(raw.SourceURL),
  native:pick(raw,['CalendarId','CalendarID','Date','Actual','Forecast','TEForecast','Previous','Revised','DateSpan','Importance','LastUpdate','Reference','ReferenceDate','Ticker','Symbol','Source','SourceURL','URL','Unit','Currency'])};
 return record('economic-calendar','trading-economics','calendar',payload,{retrievedAt,vendorRecordId:eventId,sourceUrl:payload.sourceUrl,asOf:payload.lastUpdate});
}
function indicator(raw,retrievedAt){
 const indicatorId=optionalText(raw.HistoricalDataSymbol??raw.Ticker)??[optionalText(raw.Country),optionalText(raw.Category)].join(':');if(!indicatorId||indicatorId===':')fail('INVALID_RESPONSE',502);
 const payload={indicatorId,country:optionalText(raw.Country),indicator:optionalText(raw.Category),value:scalar(raw.LatestValue),referencePeriod:optionalText(raw.LatestValueDate),frequency:optionalText(raw.Frequency),unit:optionalText(raw.Unit),lastUpdate:providerUtc(raw.LastUpdate),source:optionalText(raw.Source),sourceUrl:url(raw.SourceURL),
  native:pick(raw,['Country','Category','Title','LatestValue','LatestValueDate','PreviousValue','PreviousValueDate','Frequency','Unit','HistoricalDataSymbol','Ticker','LastUpdate','Source','SourceURL','URL'])};
 return record('indicators','trading-economics','country',payload,{retrievedAt,vendorRecordId:indicatorId,sourceUrl:payload.sourceUrl,asOf:payload.lastUpdate});
}
function forecast(raw,retrievedAt,selected){
 const indicatorId=optionalText(raw.HistoricalDataSymbol??raw.Ticker)??[optionalText(raw.Country),optionalText(raw.Category)].join(':');if(!indicatorId||indicatorId===':')fail('INVALID_RESPONSE',502);
 const payload={indicatorId,country:optionalText(raw.Country),indicator:optionalText(raw.Category),vendorModel:'Trading Economics',historical:{value:scalar(raw.LatestValue),referencePeriod:optionalText(raw.LatestValueDate)},
  points:selected.map(h=>({horizon:h,value:scalar(raw[h]),targetDate:optionalText(raw[h+'_date'])})),unit:optionalText(raw.Unit),frequency:optionalText(raw.Frequency),lastUpdate:providerUtc(raw.ForecastLastUpdate),forecastCorePrediction:false,
  native:pick(raw,['Country','Category','Title','LatestValue','LatestValueDate',...horizons,'q1_date','q2_date','q3_date','q4_date','ForecastLastUpdate','Frequency','Unit','HistoricalDataSymbol'])};
 return record('external-forecasts','trading-economics','forecast',payload,{retrievedAt,vendorRecordId:indicatorId,asOf:payload.lastUpdate});
}
function news(raw,retrievedAt){
 const r=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k.toLowerCase(),v]));
 const id=optionalText(r.id);if(!id)fail('INVALID_RESPONSE',502);
 const sourceUrl=teUrl(r.url,true);
 const publishedAt=providerUtc(r.date),importance=r.importance===undefined||r.importance===null?null:Number(r.importance);
 if(importance!==null&&![0,1,2,3].includes(importance))fail('INVALID_RESPONSE',502);
 const payload={kind:'NEWS_ARTICLE',title:optionalText(r.title),description:optionalText(r.description),url:sourceUrl,publisher:{id:'trading-economics',name:'Trading Economics'},
  publishedAt,modifiedAt:providerUtc(r.lastupdate),indexedAt:null,language:null,publisherCountry:null,eventGeography:null,providerDateMetadata:{},
  commentary:{country:optionalText(r.country),category:optionalText(r.category),symbol:optionalText(r.symbol),importance,type:optionalText(r.type)},
  native:pick(r,['id','title','date','description','country','category','symbol','url','importance','type','lastupdate'])};
 return record('news-discovery','trading-economics','news',payload,{retrievedAt,vendorRecordId:id,sourceUrl,asOf:publishedAt});
}
function marketForecast(raw,retrievedAt){
 const symbol=optionalText(raw.Symbol);if(!symbol)fail('INVALID_RESPONSE',502);
 const payload={indicatorId:symbol,country:optionalText(raw.Country),indicator:null,forecastType:'markets',symbol,marketType:optionalText(raw.Type),vendorModel:'Trading Economics',
  historical:{value:scalar(raw.Last),referencePeriod:optionalText(raw.Date)},points:[1,2,3,4].map(n=>({horizon:'Forecast'+n,value:scalar(raw['Forecast'+n]),targetDate:optionalText(raw['ForecastDate'+n])})),
  unit:optionalText(raw.Unit),frequency:null,lastUpdate:null,forecastCorePrediction:false,
  instrumentMappingStatus:'NOT_ADOPTED_BY_MARKET_DATA',native:pick(raw,['Symbol','Country','Date','Type','Last','Unit','URL','Importance',...[1,2,3,4].flatMap(n=>['Forecast'+n,'ForecastDate'+n])])};
 const sourceUrl=teUrl(raw.URL);
 return record('external-forecasts','trading-economics','markets/forecasts',payload,{retrievedAt,vendorRecordId:symbol,sourceUrl});
}
/** @param {{apiKey?:string,fetchImpl?:Function,now?:()=>string}} options */
export function createTradingEconomicsProvider({apiKey,fetchImpl,now=()=>new Date().toISOString()}={}){
 const key=credential(apiKey);
 return Object.freeze({/** @param {string} family @param {any} criteria @param {{signal?:AbortSignal}} options */
 async search(family,criteria,{signal}=/** @type {{signal?:AbortSignal}} */({})){
  const plan=prepareTradingEconomics(family,criteria),rows=await providerJson(fetchImpl,plan.url,{Authorization:key},{signal});
  if(!Array.isArray(rows)||rows.length>10000||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))fail('INVALID_RESPONSE',502);
  let filtered=rows;const selectedIndicators=plan.localIndicators;if(selectedIndicators)filtered=filtered.filter(r=>selectedIndicators.some(v=>String(r.Category??'').toLowerCase()===v.toLowerCase()));
  if(plan.eventText)filtered=filtered.filter(r=>String(r.Event??'').toLocaleLowerCase().includes(plan.eventText.toLocaleLowerCase()));
  if(plan.localText)filtered=filtered.filter(r=>[r.title??r.Title,r.description??r.Description].some(v=>typeof v==='string'&&v.toLocaleLowerCase().includes(plan.localText.toLocaleLowerCase())));
  if(plan.localSymbols)filtered=filtered.filter(r=>typeof r.Symbol==='string'&&plan.localSymbols.some(v=>v.toUpperCase()===r.Symbol.toUpperCase()));
  const retrievedAt=now(),normalize=family==='news-discovery'?news:family==='economic-calendar'?calendar:family==='indicators'?indicator:plan.market?marketForecast:(r,t)=>forecast(r,t,plan.horizons);
  const items=filtered.slice(0,plan.limit).map(row=>normalize(row,retrievedAt));
  const answer=result(family,'trading-economics',items,{retrievedAt,page:1,pageSize:plan.limit,more:filtered.length>plan.limit?true:null,total:null,truncated:filtered.length>plan.limit});
  answer.coverage={scope:'PROVIDER_RETURNED_SUBSET',completeness:filtered.length>plan.limit?'INCOMPLETE':'UNKNOWN',providerReturned:rows.length,matchedLocally:filtered.length,returned:items.length,nativeFilters:plan.nativeFilters,localFilters:plan.localFilters};
  return answer;
 }});
}
