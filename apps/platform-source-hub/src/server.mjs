import {createServer} from 'node:http';
import {createPeerOperationVerifier,peerOperationAttribution} from '@profitia/platform-contracts/peer-operation';
import {parseHubRequest,assertHubResponse,closed,SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
import {createNewsApiProvider,prepareSearch,preparePublishers} from './providers/newsapi.mjs';
import {createBraveProvider,prepareBrave} from './providers/brave.mjs';
import {createTradingEconomicsProvider,prepareTradingEconomics} from './providers/trading-economics.mjs';
import {record,result} from './transport.mjs';
import {getCatalogue} from './capabilities.mjs';
import {safeError} from './errors.mjs';
import {createTelemetry,assertNoSecret} from './observability.mjs';
/** @type {ReadonlyArray<{method:'POST',path:string,maximumRequestBytes:number,requireIdempotencyKey:boolean}>} */
export const PEER_ROUTES=Object.freeze([{method:'POST',path:'/v1/acquire',maximumRequestBytes:16384,requireIdempotencyKey:true}]);
export function peerConfiguration(c){return {environment:c.environment,callerApplicationId:c.callerApplicationId,receiverApplicationId:c.applicationId,sourceOrigin:c.callerOrigin,targetOrigin:c.publicOrigin,keyId:c.peerKeyId,key:c.secrets.peerKey,routes:PEER_ROUTES,internalOrigins:[]};}
export function validateProviderRequest(request){
 if(request.provider==='newsapi')return request.operation==='search'?prepareSearch(request.criteria):preparePublishers(request.criteria);
 if(request.provider==='brave')return prepareBrave(request.criteria);
 return prepareTradingEconomics(request.family,request.criteria);
}
async function acquire(configuration,request,transport,signal){
 if(request.provider==='newsapi'){
  const adapter=createNewsApiProvider({apiKey:configuration.secrets.newsapi,targetEnvironment:'development',fetchImpl:(url,options)=>transport.fetchImpl(url,{...options,signal:AbortSignal.any([options.signal,signal])})});
  const r=await (request.operation==='search'?adapter.search(request.criteria):adapter.listPublishers(request.criteria));
  return result(request.family,request.provider,r.items.map(p=>record(request.family,request.provider,request.operation,{kind:request.operation==='publishers'?'PUBLISHER':'NEWS_ARTICLE',url:p.url,title:p.headline??p.name??null,description:p.summary??p.description??null,publishedAt:p.publishedAt??null,modifiedAt:null,indexedAt:null,eventGeography:null,language:p.language??null,publisherCountry:p.publisherCountry??null,publisher:p.publisher??null,providerDateMetadata:{},native:Object.fromEntries(Object.entries(p).filter(([k])=>k!=='discoveredAt'))},{retrievedAt:r.observedAt,vendorRecordId:p.id??null,sourceUrl:p.url??null})),{retrievedAt:r.observedAt,page:'page' in r?r.page:null,pageSize:'pageSize' in r?r.pageSize:null,total:'totalAvailable' in r?r.totalAvailable:r.items.length,more:'moreResultsReported' in r?r.moreResultsReported:null});
 }
 if(request.provider==='brave')return createBraveProvider({apiKey:configuration.secrets.brave,fetchImpl:transport.fetchImpl}).search(request.criteria,{signal});
 return createTradingEconomicsProvider({apiKey:configuration.secrets.tradingEconomics,fetchImpl:transport.fetchImpl}).search(request.family,request.criteria,{signal});
}
export function createApplication({configuration,authorizer,repository,admission,telemetry=createTelemetry()}){
 const verify=createPeerOperationVerifier(peerConfiguration(configuration));
 async function dispatch(request){
  const u=new URL(request.url);
  if(request.method==='GET'&&['/health','/live','/ready'].includes(u.pathname)){
   const ready=u.pathname!=='/ready'||await repository.ready()&&await authorizer.ready()&&await admission.ready();return new Response(JSON.stringify({service:'platform-source-hub',status:ready?'ok':'not_ready'}),{status:ready?200:503});
  }
  if(request.method==='GET'&&u.pathname==='/v1/capabilities')return Response.json(getCatalogue());
  if(request.method!=='POST'||u.pathname!=='/v1/acquire'||u.search)throw new SourceHubError('NOT_FOUND',404);
  if(!await verify(request))throw new SourceHubError('PEER_AUTHENTICATION_REQUIRED',401);
  const envelope=await request.clone().json().catch(()=>{throw new SourceHubError('INVALID_JSON');});
  if(!closed(envelope,['context','request'])||!closed(envelope.context,['organisationId','expectedUserId']))throw new SourceHubError('INVALID_REQUEST');
  const command=parseHubRequest(envelope.request);validateProviderRequest(command);
  const peer=peerOperationAttribution(request);if(!peer)throw new SourceHubError('PEER_AUTHENTICATION_REQUIRED',401);
  const args={request,organisationId:envelope.context.organisationId,resourceId:'source-hub-private',write:true};
  const authorized=action=>authorizer.execute(args,(context,transaction)=>{
   if(context.subjectUserId!==envelope.context.expectedUserId||context.organisationId!==envelope.context.organisationId)throw new SourceHubError('VERIFIED_CONTEXT_MISMATCH',403);
   return action(context,transaction);
  });
  const started=await authorized((c,t)=>repository.begin(t,c,command,peer.callerApplicationId,request.headers.get('idempotency-key')));
  if(started.kind==='replay'){await admission.assertCurrent(command.provider,command.family,started.licence);assertHubResponse(started.body,command);assertNoSecret(started.body,configuration.secrets);return Response.json(started.body);}
  let transport;
  try{
   transport=await admission.transportFor(command.provider,command.family,started.licence,started.intentKey);
   const body=await acquire(configuration,command,transport,request.signal);assertNoSecret(body,configuration.secrets);
   const completed=await authorized(async(c,t)=>{const answer=await repository.complete(t,c,started,command,peer.callerApplicationId,body,transport.receipt.value);assertHubResponse(answer,command);assertNoSecret(answer,configuration.secrets);return answer;});
   return Response.json(completed);
  }catch(error){
   // Fresh E1 also gates this write. Revocation may leave a pending record for
   // owner reconciliation; never impersonate an owner to force a FAILED row.
   await authorized((c,t)=>repository.failed(t,c,started,command,safeError(error),transport?.receipt??{certainty:'NOT_SENT',upstreamAttempts:0,value:null})).catch(()=>{});throw error;
  }
 }
 return Object.freeze({async handle(request){const requestId=telemetry.requestId(),start=performance.now();let response,outcome='OK';
  try{response=await dispatch(request);}catch(error){const safe=safeError(error);outcome=safe.code;response=Response.json({error:{code:safe.code,retryAfterSeconds:'retryAfterSeconds' in safe?safe.retryAfterSeconds:null},requestId},{status:safe.status});}
  response.headers.set('cache-control','no-store');response.headers.set('x-request-id',requestId);response.headers.set('content-type','application/json');
  telemetry.emit({requestId,service:'platform-source-hub',operation:['/health','/live','/ready','/v1/capabilities','/v1/acquire'].includes(new URL(request.url).pathname)?new URL(request.url).pathname:'unknown',outcome,status:response.status,durationMs:performance.now()-start});return response;
 }});
}
export function createHttpServer(application,configuration){
 const server=createServer(async(req,res)=>{const controller=new AbortController();req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded)controller.abort();});
  try{
   const path=new URL(req.url??'/',configuration.publicOrigin);if(path.origin!==configuration.publicOrigin)throw new SourceHubError('INVALID_REQUEST');
   const health=['/health','/live','/ready'].includes(path.pathname);if(!health&&req.headers.host!==new URL(configuration.publicOrigin).host)throw new SourceHubError('INVALID_AUTHORITY',400);
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw new SourceHubError('REQUEST_TOO_LARGE',413);chunks.push(chunk);}
   const headers=new Headers();for(const [k,v]of Object.entries(req.headers)){if(Array.isArray(v))throw new SourceHubError('INVALID_HEADERS');if(v!==undefined)headers.set(k,v);}
   const request=new Request(path,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method??'GET')?{body:Buffer.concat(chunks)}:{}),signal:controller.signal});
   const response=await application.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){const safe=safeError(error);res.writeHead(safe.status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:{code:safe.code}}));}
 });server.requestTimeout=20000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=40;return server;
}
