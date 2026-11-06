import {createPlatformIngestionHost,platformIngestionSchemaDigest,unmeteredSourceSchemaDigest} from '@profitia/platform-contracts/platform-ingestion';
import {createExternalCallHost,externalCallSchemaDigest,nativeExternalTransportSchemaDigest,apiPathTransportSchemaDigest,marketSymbolTransportSchemaDigest,externalCallEvidence,externalNativeResponse,ExternalCallUnavailable} from '@profitia/platform-contracts/external-call';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
import {DiscoveryError} from './providers/newsapi.mjs';
import {credential} from './transport.mjs';
import {eiaWireUrl} from './providers/eia.mjs';
export const SOURCE_CONTROL_VERSION='source-hub-api-control-v1';
export const SOURCE_DEFINITIONS=Object.freeze({
 'newsapi:news-discovery':{origin:'https://newsapi.org',paths:['/v2/everything','/v2/top-headlines','/v2/top-headlines/sources']},
 'brave:news-discovery':{origin:'https://api.search.brave.com',paths:['/res/v1/web/search']},
 'trading-economics:news-discovery':{origin:'https://api.tradingeconomics.com',paths:['/news'],prefix:'/news/'},
 'trading-economics:economic-calendar':{origin:'https://api.tradingeconomics.com',paths:['/calendar'],prefix:'/calendar/'},
 'trading-economics:indicators':{origin:'https://api.tradingeconomics.com',paths:['/country'],prefix:'/country/'},
 'trading-economics:external-forecasts':{origin:'https://api.tradingeconomics.com',paths:['/forecast'],prefix:'/forecast/',marketPaths:['index','currency','crypto','commodity','bond'].map(c=>'/markets/forecasts/'+c)}
});
const OPTIONAL_SOURCE_DEFINITIONS=Object.freeze({
 'trading-economics:market-observations':{origin:'https://api.tradingeconomics.com',paths:['/markets/commodities'],marketSymbolPrefixes:['/markets/historical/']}
});
export const COMMODITY_SOURCE_DEFINITIONS=Object.freeze({
 'eia:data-catalog':{origin:'https://api.eia.gov',paths:['/v2/'],prefix:'/v2/',suffix:'/'},
 'eia:series-observations':{origin:'https://api.eia.gov',paths:[],basePaths:['/v2/'],prefix:'/v2/',suffix:'/data/'},
 'cftc:data-catalog':{origin:'https://publicreporting.cftc.gov',paths:['/api/views.json'],prefix:'/api/views/',suffix:'.json'},
 'cftc:positioning-observations':{origin:'https://publicreporting.cftc.gov',paths:[],basePaths:['/resource/jun7-fc8e.json'],prefix:'/resource/',suffix:'.json'},
 'commodities-sh:data-catalog':{origin:'https://api.commodities.sh',paths:['/v1/catalog','/openapi.json']},
 'commodities-sh:publication-calendar':{origin:'https://api.commodities.sh',paths:['/v1/calendar']}
});
export function sourceDefinition(provider,family,{includeMarketForecasts=false}={}){
 const d=SOURCE_DEFINITIONS[provider+':'+family]??COMMODITY_SOURCE_DEFINITIONS[provider+':'+family]??OPTIONAL_SOURCE_DEFINITIONS[provider+':'+family];if(!d)throw new SourceHubError('UNSUPPORTED_FAMILY');
 return {...d,sourceId:'source-hub.'+provider+'.'+family,resourceId:'api.'+provider+'.'+family,
  pathRules:('basePaths' in d?d.basePaths:d.paths).map(path=>({method:'GET',path})),nativePathRules:[...d.paths.map(path=>({method:'GET',path,requestFormat:'NONE'})),...(includeMarketForecasts&&'marketPaths' in d?d.marketPaths:[]).map(path=>({method:'GET',path,requestFormat:'NONE'})),...('prefix' in d&&d.prefix?[{method:'GET',prefix:d.prefix,suffix:'suffix' in d?d.suffix:'',parameter:'API_PATH',requestFormat:'NONE'}]:[]),...('marketSymbolPrefixes' in d?d.marketSymbolPrefixes.map(prefix=>({method:'GET',prefix,suffix:'',parameter:'MARKET_SYMBOL',requestFormat:'NONE'})):[])]};
}
export async function createAdmission(configuration,database){
 const sourceDigest=await platformIngestionSchemaDigest(),externalDigest=await externalCallSchemaDigest(),nativeDigest=await nativeExternalTransportSchemaDigest(),apiDigest=await apiPathTransportSchemaDigest(),marketDigest=await marketSymbolTransportSchemaDigest();let inFlight=0;
 const binding={applicationId:configuration.applicationId,environment:configuration.environment,projectId:configuration.projectId,branchId:configuration.branchId,databaseName:configuration.databaseName,role:configuration.sourceRole,deploymentId:configuration.deploymentId,configurationVersion:configuration.configurationVersion,schemaDigest:sourceDigest,unmeteredSchemaDigest:await unmeteredSourceSchemaDigest()};
 /** @type {import('@profitia/platform-contracts/operation-context').Application} */
 const application={appId:configuration.applicationId,profileId:'PLATFORM_INTERNAL',deploymentId:configuration.deploymentId,configurationVersion:configuration.configurationVersion,environment:configuration.environment,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']};
 async function assertCurrent(provider,family,licence){
  const d=sourceDefinition(provider,family,{includeMarketForecasts:licence.allow_market_forecasts===true});
  if(licence.source_id!==d.sourceId||licence.resource_id!==d.resourceId)throw new SourceHubError('SOURCE_BINDING_MISMATCH',503);
  const check=await database.query('SELECT profitia_external_native.descriptor($1,$2) AS descriptor',[d.sourceId,d.resourceId]).catch(()=>({rows:[]}));
  if(check.rows.length!==1||check.rows[0].descriptor?.policyId!==licence.source_policy_id)throw new SourceHubError('SOURCE_ADMISSION_REQUIRED',503);
  return d;
 }
 async function transportFor(provider,family,licence,intentKey){
  const d=await assertCurrent(provider,family,licence);
  const sourceHost=createPlatformIngestionHost({application,binding,source:{id:d.sourceId,payloadSchema:'external-call-control-v1',qualityVersion:SOURCE_CONTROL_VERSION,classificationVersion:'TECHNICAL_CONTROL_NO_PRIVATE_DATA'},
   independentQuery:database.query,transact:database.transact,
   validateSharedPayload:content=>!!content&&typeof content==='object'&&!Array.isArray(content)&&Object.getPrototypeOf(content)===Object.prototype&&Object.keys(content).sort().join(',')==='action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status'
    &&['PLAN','ATTEMPT','SETTLE'].includes(String(content.action))&&!Object.values(content).some(v=>v!==null&&typeof v==='object')});
  if(['eia','cftc','commodities-sh'].includes(provider)&&!configuration.commodityProviders?.includes(provider))throw new SourceHubError('PROVIDER_NOT_ACTIVATED',503);
  const key=provider==='newsapi'?credential(configuration.secrets.newsapi):provider==='brave'?credential(configuration.secrets.brave):provider==='trading-economics'?credential(configuration.secrets.tradingEconomics):null;
  /** @type {Record<string,string>} */
  const headers=provider==='newsapi'?{'X-Api-Key':credential(key)}:provider==='brave'?{'X-Subscription-Token':credential(key)}:provider==='trading-economics'?{Authorization:credential(key)}:{};
  /** @type {import('@profitia/platform-contracts/external-call').NativeExternalTransport & {credentialMode:'SERVER_HEADERS'}} */
  const nativeTransport={schemaDigest:nativeDigest,...('prefix' in d&&d.prefix?{apiPathSchemaDigest:apiDigest}:{}),...('marketSymbolPrefixes' in d?{marketSymbolSchemaDigest:marketDigest}:{}),pathRules:d.nativePathRules,redirectOrigins:[],maximumResponseBytes:2*1024*1024,credentialMode:'SERVER_HEADERS',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'};
  const host=createExternalCallHost({sourceHost,sourceId:d.sourceId,resourceId:d.resourceId,
   binding:{role:configuration.sourceRole,configurationVersion:configuration.configurationVersion,origin:d.origin,transport:'HTTPS',schemaDigest:externalDigest,pathRules:d.pathRules},
   nativeTransport,independentQuery:database.query,query:(transaction,sql,values)=>transaction.query(sql,values),
   parseCommand:command=>{if(!command||typeof command!=='object'||Object.keys(command).join(',')!=='url'||!('url' in command)||typeof command.url!=='string')throw new SourceHubError('INVALID_PROVIDER_COMMAND');const u=new URL(command.url);if(u.origin!==d.origin||u.username||u.password||u.hash||[...u.searchParams.keys()].some(k=>/^(?:c|api_?key|token|secret|authorization)$/i.test(k)))throw new SourceHubError('INVALID_PROVIDER_COMMAND');return {url:u.href};},
   buildRequest:command=>({method:'GET',url:provider==='eia'?eiaWireUrl(command.url,configuration.secrets.eia):command.url,body:null}),getHeaders:()=>headers});
  /** @type {{value:Readonly<import('@profitia/platform-contracts/external-call').ExternalCallEvidence>|null,certainty:string,upstreamAttempts:number|null}} */
  const receipt={value:null,certainty:'NOT_SENT',upstreamAttempts:0};
  return Object.freeze({receipt,async fetchImpl(url,options){
   if(inFlight>=4)throw provider==='newsapi'?new DiscoveryError('PROVIDER_BUSY',[],503):new SourceHubError('PROVIDER_BUSY',503);
   inFlight++;
   try{
    const result=await host.execute({command:{url},intentKey},{signal:options?.signal});const evidence=externalCallEvidence(result);
    if(!evidence)throw new SourceHubError('SOURCE_RECEIPT_UNVERIFIED',503);
    receipt.value=evidence;receipt.certainty='RESPONSE';receipt.upstreamAttempts=1;return externalNativeResponse(result);
   }catch(error){
    receipt.certainty=error instanceof ExternalCallUnavailable?error.certainty:'UNVERIFIED';receipt.upstreamAttempts=receipt.certainty==='NOT_SENT'?0:null;
    const code=receipt.certainty==='NOT_SENT'?'SOURCE_ADMISSION_UNAVAILABLE':'EXTERNAL_RESULT_UNVERIFIED';
    throw provider==='newsapi'?new DiscoveryError(code,[],503):new SourceHubError(code,503);
   }finally{inFlight--;}
  }});
 }
 return Object.freeze({binding,assertCurrent,transportFor,async ready(){try{for(const v of [configuration.secrets.newsapi,configuration.secrets.brave,configuration.secrets.tradingEconomics,...(configuration.commodityProviders?.includes('eia')?[configuration.secrets.eia]:[])])credential(v);await database.verifyLogin();for(const k of Object.keys({...SOURCE_DEFINITIONS,...COMMODITY_SOURCE_DEFINITIONS})){const [provider,family]=k.split(':');if(['eia','cftc','commodities-sh'].includes(provider)&&!configuration.commodityProviders?.includes(provider))continue;const d=sourceDefinition(provider,family);const r=await database.query('SELECT profitia_external_native.descriptor($1,$2) AS descriptor',[d.sourceId,d.resourceId]);if(!r.rows[0]?.descriptor)return false;}return true;}catch{return false;}}});
}
