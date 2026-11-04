import {fields,text,list,integer,day,optionalText,scalar,url,providerUtc,providerJson,credential,record,result,fail} from '../transport.mjs';
export const TE_ORIGIN='https://api.tradingeconomics.com';
const horizons=['q1','q2','q3','q4','YearEnd','YearEnd2','YearEnd3'];
function names(value,max=10){return list(value,max).map(v=>{if(!/^[\p{L}\p{N} ._()+%&='-]+$/u.test(v)||v.includes('..')||/%[a-f0-9]{2}/i.test(v))fail();return v;});}
const pathPart=values=>values.map(encodeURIComponent).join(',');
export function prepareTradingEconomics(family,criteria){
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
 return {url:TE_ORIGIN+path+'?'+p,limit,localIndicators,eventText:c.eventText??null,horizons:c.horizons??horizons};
}
const pick=(raw,keys)=>Object.fromEntries(keys.filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]]));
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
/** @param {{apiKey?:string,fetchImpl?:Function,now?:()=>string}} options */
export function createTradingEconomicsProvider({apiKey,fetchImpl,now=()=>new Date().toISOString()}={}){
 const key=credential(apiKey);
 return Object.freeze({/** @param {string} family @param {any} criteria @param {{signal?:AbortSignal}} options */
 async search(family,criteria,{signal}=/** @type {{signal?:AbortSignal}} */({})){
  const plan=prepareTradingEconomics(family,criteria),rows=await providerJson(fetchImpl,plan.url,{Authorization:key},{signal});
  if(!Array.isArray(rows)||rows.length>10000||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))fail('INVALID_RESPONSE',502);
  let filtered=rows;const selectedIndicators=plan.localIndicators;if(selectedIndicators)filtered=filtered.filter(r=>selectedIndicators.some(v=>String(r.Category??'').toLowerCase()===v.toLowerCase()));
  if(plan.eventText)filtered=filtered.filter(r=>String(r.Event??'').toLocaleLowerCase().includes(plan.eventText.toLocaleLowerCase()));
  const retrievedAt=now(),normalize=family==='economic-calendar'?calendar:family==='indicators'?indicator:(r,t)=>forecast(r,t,plan.horizons);
  const items=filtered.slice(0,plan.limit).map(row=>normalize(row,retrievedAt));
  return result(family,'trading-economics',items,{retrievedAt,page:1,pageSize:plan.limit,more:filtered.length>plan.limit,total:filtered.length,truncated:filtered.length>plan.limit});
 }});
}
