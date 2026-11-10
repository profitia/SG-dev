export const NEWS_DISCOVERY_CONTRACT_VERSION = '0.1.0';
import {parseCommodityRequest,assertCommodityResponse} from './commodities-v1.mjs';
export {COMMODITY_CONTRACT_VERSION,PUBLICATION_SCHEDULE_CONTRACT_VERSION,DURABLE_SCHEDULE_CONTRACT_VERSION,DURABLE_RESULT_CONTRACT_VERSION,COMMODITY_PROVIDERS,COMMODITY_FAMILIES} from './commodities-v1.mjs';
export const SOURCE_HUB_CONTRACT_VERSION = '1.0.0';
export const CONTRACT_FAMILIES = Object.freeze(['news-discovery','economic-calendar','indicators','external-forecasts','market-observations']);
export const IMPLEMENTATION_STATES = Object.freeze(['IMPLEMENTED_AND_LIVE_VERIFIED','IMPLEMENTED_OFFLINE_VERIFIED','UNAVAILABLE_OR_NOT_ENTITLED','NOT_IMPLEMENTED']);
const supported = Object.freeze({newsapi:['news-discovery'],brave:['news-discovery'],'trading-economics':['news-discovery','economic-calendar','indicators','external-forecasts','market-observations']});
export class SourceHubError extends Error {
  /** @param {string} code @param {number} status @param {number|null} retryAfterSeconds */
  constructor(code, status=400, retryAfterSeconds=null) { super(code);this.name='SourceHubError';this.code=code;this.status=status;this.retryAfterSeconds=retryAfterSeconds; }
  toJSON() { return {code:this.code,retryAfterSeconds:this.retryAfterSeconds}; }
}
export function closed(value, keys) { return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k)); }
export function parseHubRequest(value) {
  if(['1.1.0','1.2.0','1.3.0','1.4.0'].includes(value?.contractVersion))return parseCommodityRequest(value);
  if(!closed(value,['contractVersion','family','provider','operation','criteria'])||value.contractVersion!==SOURCE_HUB_CONTRACT_VERSION
    ||!Object.hasOwn(supported,value.provider)||!supported[value.provider].includes(value.family)
    ||!['search','publishers'].includes(value.operation)||value.operation==='publishers'&&value.provider!=='newsapi'
    ||!closed(value.criteria,Object.keys(value.criteria??{}))) throw new SourceHubError('INVALID_CONTRACT');
  const fields=value.provider==='newsapi'?(value.operation==='publishers'?['category','language','publisherCountry']:['mode','text','terms','fields','category','editionCountry','publisherIds','domains','excludedDomains','language','publishedAfter','publishedBefore','order','page','pageSize','eventLocation']):value.provider==='brave'?['text','resultType','country','language','uiLanguage','freshness','count','offset','safeSearch','spellcheck','extraSnippets','domains','excludedDomains']:value.family==='market-observations'?['mode','symbols','instrumentUrls','from','to','limit']:value.family==='news-discovery'?['countries','indicators','tickers','limit','newsType','from','to','text']:value.family==='external-forecasts'&&value.criteria.forecastType==='markets'?['forecastType','symbols','marketCategory','limit']:['countries','indicators','tickers','limit',...(value.family==='economic-calendar'?['eventIds','from','to','importance','eventText']:value.family==='external-forecasts'?['horizons']:[])];
  if(!closed(value.criteria,fields))throw new SourceHubError('UNSUPPORTED_CRITERIA');
  return structuredClone(value);
}
export function assertHubResponse(value, expected) {
  if(['1.1.0','1.2.0','1.3.0','1.4.0'].includes(expected?.contractVersion))return assertCommodityResponse(value,expected);
  if(!expected||!['search','publishers'].includes(expected.operation)||!closed(value,['contractVersion','family','provider','status','items','page','provenance','usage','coverage'])
    ||value.contractVersion!==SOURCE_HUB_CONTRACT_VERSION||value.family!==expected.family||value.provider!==expected.provider
    ||!['ok','empty'].includes(value.status)||!Array.isArray(value.items)||value.items.length>1000
    ||value.status==='empty'&&value.items.length!==0||value.status==='ok'&&value.items.length===0
    ||!closed(value.provenance,['retrievedAt','licenceRef','qualityStatus'])||!Number.isFinite(Date.parse(value.provenance.retrievedAt))
    ||typeof value.provenance.licenceRef!=='string'||!value.provenance.licenceRef.length||value.provenance.licenceRef==='PENDING_ADMISSION'
    ||!value.items.every(item=>closed(item,['metadata','payload'])&&item.metadata?.contractFamily===value.family
      &&item.metadata.contractVersion===SOURCE_HUB_CONTRACT_VERSION&&item.metadata.providerId===value.provider
      &&typeof item.metadata.sourceRecordRef==='string'&&typeof item.metadata.contentFingerprint==='string'&&item.payload&&typeof item.payload==='object'))
    throw new SourceHubError('INVALID_UPSTREAM_RESPONSE',502);
  const validTime=x=>x===null||typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));
  const validText=x=>x===null||typeof x==='string'&&x.length<=16384;
  const validUrl=x=>{try{const u=new URL(x);return typeof x==='string'&&x.length<=4096&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
  const reject=()=>{throw new SourceHubError('INVALID_UPSTREAM_RESPONSE',502);};
  if(value.coverage!==undefined){const c=value.coverage;
   if(!closed(c,['scope','completeness','providerReturned','matchedLocally','returned','nativeFilters','localFilters','operatorSemantics','providerQueryAltered'])
    ||c.scope!=='PROVIDER_RETURNED_SUBSET'||!['UNKNOWN','INCOMPLETE'].includes(c.completeness)
    ||!['providerReturned','matchedLocally','returned'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0&&c[k]<=10000)
    ||c.returned!==value.items.length||c.returned>c.matchedLocally||c.matchedLocally>c.providerReturned
    ||!['nativeFilters','localFilters'].every(k=>Array.isArray(c[k])&&c[k].length<=20&&c[k].every(n=>typeof n==='string'&&n.length<=80))
    ||c.operatorSemantics!==undefined&&c.operatorSemantics!=='EXPERIMENTAL_UNVERIFIED'
    ||c.providerQueryAltered!==undefined&&c.providerQueryAltered!==null&&typeof c.providerQueryAltered!=='boolean')reject();
  }
  if(!value.page||!['page','pageSize','total'].every(k=>value.page[k]===null||Number.isSafeInteger(value.page[k])&&value.page[k]>=0)
   ||!(value.page.more===null||typeof value.page.more==='boolean')||typeof value.page.truncated!=='boolean'
   ||!value.usage||![0,1].includes(value.usage.upstreamAttempts)||typeof value.usage.cacheHit!=='boolean'
   ||typeof value.usage.receiptRef!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.usage.receiptRef))reject();
  for(const item of value.items){const m=item.metadata,p=item.payload;
   if(!/^[a-f0-9]{64}$/.test(m.contentFingerprint)||!m.sourceRecordRef.length||m.sourceRecordRef.length>512||m.apiFamily!==value.family
    ||typeof m.endpointVersion!=='string'||!m.endpointVersion.length||m.endpointVersion.length>200||!validText(m.vendorRecordId)||(m.sourceUrl!==null&&!validUrl(m.sourceUrl))
    ||!validTime(m.retrievedAt)||m.retrievedAt===null||!validTime(m.availableAt)||!validTime(m.asOf)
    ||!validTime(m.retentionUntil)||m.licenceRef!==value.provenance.licenceRef||m.licenceRef==='PENDING_ADMISSION'
    ||m.usageReceiptRef!==value.usage.receiptRef||m.redistribution!=='PRIVATE_AUTHORISED_CONSUMER_ONLY'
    ||!['PROVIDER_REPORTED','UNKNOWN'].includes(m.qualityStatus))reject();
   if(m.consumerStorage!==undefined){const s=m.consumerStorage;if(value.family!=='economic-calendar'||!closed(s,['mode','basisRef','licenceVersion'])||s.mode!=='DURABLE_OWNER_ENTITLEMENT'||typeof s.basisRef!=='string'||!s.basisRef.length||s.basisRef.length>256||typeof s.licenceVersion!=='string'||!/^[1-9][0-9]*$/.test(s.licenceVersion))reject();}
   if(value.family==='news-discovery'){
    if(!['NEWS_ARTICLE','WEB_PAGE','PUBLISHER'].includes(p.kind)||expected.operation==='search'&&p.kind==='PUBLISHER'
     ||!validUrl(p.url)||!validText(p.title)||!validText(p.description)||!validTime(p.publishedAt)||!validTime(p.modifiedAt)||!validTime(p.indexedAt)
     ||p.eventGeography!==null||!validText(p.language)||!validText(p.publisherCountry))reject();
   }else if(value.family==='economic-calendar'){
    if(typeof p.eventId!=='string'||!p.eventId.length||!validTime(p.eventAt)||!validTime(p.lastUpdate)
     ||!['REPORTED','SCHEDULED','UNKNOWN'].includes(p.releaseStatus)||!['PAST','FUTURE','UNKNOWN'].includes(p.temporalPosition)
     ||!['actual','consensusForecast','vendorForecast','previous','revised'].every(k=>p[k]===null||typeof p[k]==='string'||typeof p[k]==='number'&&Number.isFinite(p[k])))reject();
   }else if(value.family==='indicators'){
    if(typeof p.indicatorId!=='string'||!p.indicatorId.length||!validTime(p.lastUpdate)||!validText(p.referencePeriod)||!validText(p.unit)||!validText(p.frequency))reject();
   }else if(value.family==='external-forecasts'){
    if(p.forecastCorePrediction!==false||p.vendorModel!=='Trading Economics'||!Array.isArray(p.points)||p.points.length>7||!validTime(p.lastUpdate)
     ||!p.points.every(q=>typeof q.horizon==='string'&&(q.value===null||typeof q.value==='string'||typeof q.value==='number'&&Number.isFinite(q.value))&&(q.targetDate===null||typeof q.targetDate==='string'&&Number.isFinite(Date.parse(q.targetDate)))))reject();
   }else if(value.family==='market-observations'){
    if(!['SNAPSHOT','HISTORICAL'].includes(p.mode)||typeof p.vendorSymbol!=='string'||!p.vendorSymbol.length||!validTime(p.observationAt)||!validTime(p.lastUpdate)
     ||!['DAY','INSTANT','UNKNOWN'].includes(p.temporalPrecision)||!['VENDOR_LAST','VENDOR_CLOSE','VENDOR_VALUE'].includes(p.quoteBasis)
     ||p.mappingStatus!=='NOT_ADOPTED_BY_MARKET_DATA'||p.underlyingMappingRef!==null
     ||!['instrumentType','marketType','unit','currency','contractExpiry','rolloverRef','session'].every(k=>validText(p[k]))
     ||!(p.price===null||typeof p.price==='number'&&Number.isFinite(p.price)||typeof p.price==='string'&&p.price.length<=1000))reject();
   }else reject();
  }
  return value;
}
