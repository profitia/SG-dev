import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {Fault,digest} from './store.mjs';
import {httpContract} from '@profitia/platform-knowledge-contracts';
import {queryKnowledge} from './knowledge.mjs';
import {adminPage,adminScript,validateSchema} from './admin.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function readBody(req,max){
 const declared=req.headers['content-length'];if(declared&&(!/^\d+$/.test(declared)||Number(declared)>max))throw new Fault(413,'BODY_LIMIT');
 const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>max)throw new Fault(413,'BODY_LIMIT');chunks.push(part);}return Buffer.concat(chunks);
}
async function readJson(req){try{return JSON.parse((await readBody(req,65536)).toString('utf8'));}catch(e){if(e instanceof Fault)throw e;throw new Fault(422,'INVALID_JSON');}}
export function createServer({database,telemetry,config=null,authority=null,library=null,provider=null}){
 const enabled=config?.processingEnabled===true;
 let uploading=false;
 let pending=null,last=null,validUntil=0;
 const probe=()=>{
   if(last!==null && Date.now()<validUntil)return Promise.resolve(last);
   if(pending)return pending;
   pending=(async()=>{await Promise.resolve();try{await database.probe();telemetry.emit('FOUNDATION_PROBE_OK');last=true;validUntil=Date.now()+30000;return true;}
     catch{telemetry.emit('FOUNDATION_PROBE_FAILED');last=false;validUntil=Date.now()+5000;return false;}
     finally{pending=null;}})();return pending;
 };
 return http.createServer({maxHeaderSize:16384,requestTimeout:120000,headersTimeout:10000},async(req,res)=>{
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
   const reply=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
   if(req.method==='GET'&&req.url==='/health/live')return reply(200,{status:'LIVE',phase:enabled?'KNOWLEDGE_ENGINE':'FOUNDATION_ONLY',processingEnabled:enabled});
   if(req.method==='GET'&&req.url==='/health/ready'){
    const ready=enabled&&library&&provider&&authority&&await database.engineReady().catch(()=>false)&&await authority.ready();
    return reply(ready?200:503,{status:ready?'READY':'NOT_READY_FOR_PROCESSING',phase:enabled?'KNOWLEDGE_ENGINE':'FOUNDATION_ONLY'});
   }
   if(req.method==='GET'&&req.url==='/health/foundation'){
     if(await probe())return reply(200,{status:'FOUNDATION_DATABASE_VERIFIED',phase:'FOUNDATION_ONLY',processingEnabled:false});
     return reply(503,{status:'FOUNDATION_UNAVAILABLE'});
   }
   if(enabled){try{
    const url=new URL(req.url,config.origin);
    if(url.origin!==config.origin||url.hash||req.headers.origin&&req.headers.origin!==config.origin)throw new Fault(403,'ORIGIN_REJECTED');
    if(req.method==='GET'&&url.pathname==='/openapi.json'&&!url.search)return reply(200,httpContract);
    if(req.method==='GET'&&['/','/admin.js'].includes(url.pathname)&&!url.search){
     res.setHeader('Content-Type',url.pathname==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8');
     res.setHeader('Referrer-Policy','no-referrer');
     const clerkHost=config.clerkFrontendOrigin;
     res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'self' ${clerkHost??''}; style-src 'self' 'unsafe-inline'; connect-src 'self' ${clerkHost??''}; img-src 'self' https://img.clerk.com data:; font-src 'self' data:; frame-src ${clerkHost??"'none'"}; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
     res.writeHead(200);return res.end(url.pathname==='/'?adminPage(config):adminScript);
    }
    if(!authority||!library||!provider)throw new Fault(503,'ENGINE_NOT_CONFIGURED');
    if(req.headers.cookie)throw new Fault(403,'BEARER_ONLY');
    const request=new Request(config.origin+url.pathname,{method:req.method,headers:{...(req.headers.authorization?{authorization:req.headers.authorization}:{})}});
    let operation,resourceId='library',scopes=['PROFITIA_SHARED'],payload=null,delegation=null,action;
    const selected=url.searchParams.get('scope')??'PROFITIA_SHARED';if(!['PROFITIA_SHARED','ACCOUNT_PRIVATE'].includes(selected))throw new Fault(422,'INVALID_SCOPE');
    if(req.method==='POST'&&url.pathname==='/v1/imports'&&!url.search){
     const header=req.headers['x-pk-import'];if(typeof header!=='string'||header.length>12000||req.headers['content-type']!=='application/octet-stream')throw new Fault(422,'IMPORT_METADATA_REQUIRED');
     try{payload=JSON.parse(Buffer.from(header,'base64url').toString('utf8'));}catch{throw new Fault(422,'INVALID_IMPORT');}
     if(!validateSchema('Import',payload))throw new Fault(422,'INVALID_IMPORT');
     if(uploading)throw new Fault(429,'UPLOAD_BUSY');
     scopes=[payload.scope];operation='document.import';resourceId='library';
     delegation={jobId:randomUUID(),sourceId:randomUUID(),generationId:randomUUID(),scope:payload.scope,ownerUserId:null,
      rightsDigest:digest(payload.rights),sourceVersion:1,maximumMicrousd:1000000};
     // The internal UserID is bound centrally, never accepted from the upload.
     // For private admission the authority fills ownerUserId from actual identity.
     action=async scope=>{if(uploading)throw new Fault(429,'UPLOAD_BUSY');uploading=true;
      try{return await library.import(payload,await readBody(req,52428800),scope);}finally{uploading=false;}};
    }else if(req.method==='GET'&&url.pathname==='/v1/sources'){
     operation='document.read';scopes=[selected];action=scope=>library.list(scope);
    }else if(req.method==='GET'&&url.pathname==='/v1/capabilities'){
     operation='document.read';scopes=[selected];action=async()=>({version:'0.2.0',formats:['PDF','DOC','DOCX','PPT','PPTX','TXT','MD','MARKDOWN'],maximumBytes:52428800,maximumPdfPages:500,originalRetentionHours:24,privateKnowledgeRetentionDays:180,memory:'PREPARED_NOT_ACTIVE',queryTasks:['ANSWER','DOCUMENT_SUMMARY'],contextModels:['gpt-6-luna'],lifecycle:'POLL_CURRENT_SOURCE_STATUS',manualChunkApproval:false});
    }else if(req.method==='POST'&&url.pathname==='/v1/source-statuses'){
     payload=await readJson(req);operation='document.read';scopes=[selected];action=scope=>library.statuses(payload,scope);
    }else if(req.method==='POST'&&url.pathname==='/v1/query'&&!url.search){
     payload=await readJson(req);if(!validateSchema('Query',payload))throw new Fault(422,'INVALID_QUERY');operation='document.query';scopes=payload.scopes;
     action=scope=>queryKnowledge({pool:database.pool,provider,query:payload,scope});
    }else{
     const match=url.pathname.match(/^\/v1\/sources\/([^/]+)(?:\/(publish|withdraw|reindex))?$/);
     if(!match||!UUID.test(match[1]))throw new Fault(404,'NOT_FOUND');resourceId=match[1];scopes=[selected];
     if(req.method==='GET'&&!match[2]){operation='document.read';action=scope=>library.get(resourceId,scope);}
     else if(req.method==='POST'&&match[2]==='reindex'){
      const plan=await authority.execute(request,{operation:'document.read',resourceId,scopes:[selected],requestDigest:digest({kind:'REINDEX_PLAN',resourceId}),delegation:null},scope=>library.reindexPlan(resourceId,scope));
      operation='document.import';payload={kind:'REINDEX'};delegation={jobId:randomUUID(),sourceId:resourceId,generationId:randomUUID(),scope:plan.scope,ownerUserId:null,rightsDigest:plan.rightsDigest,sourceVersion:plan.sourceVersion,maximumMicrousd:1000000};
      action=scope=>library.reindex(resourceId,scope);
     }
     else if(req.method==='POST'&&match[2]==='publish'){payload=await readJson(req);if(!validateSchema('PublishCommand',payload))throw new Fault(422,'INVALID_PUBLICATION');operation='document.publish';scopes=['PROFITIA_SHARED'];action=scope=>library.publish(resourceId,payload,scope);}
     else if(req.method==='POST'&&match[2]==='withdraw'){operation='document.withdraw';action=scope=>library.revoke(resourceId,false,scope);}
     else if(req.method==='DELETE'&&!match[2]){operation='document.delete';action=scope=>library.revoke(resourceId,true,scope);}
     else throw new Fault(405,'METHOD_NOT_ALLOWED');
    }
    let admittedScope;const businessAction=async scope=>{admittedScope=scope;return action(scope);};
    const result=await authority.execute(request,{operation,resourceId,scopes,requestDigest:digest({method:req.method,path:url.pathname,payload}),delegation},businessAction);
    if(library.recordUse&&(operation==='document.query'||operation==='document.read'&&resourceId!=='library')){
     const used=operation==='document.query'?[...new Set((result.evidence??[]).map(e=>e.sourceId))]:[resourceId];
     await library.recordUse(used,admittedScope);
    }
    return reply(operation==='document.import'?202:200,result);
   }catch(error){const known=error instanceof Fault;telemetry.emit(!known||error.status>=500?'OPERATION_FAILED':'OPERATION_DENIED',{technicalCode:known?error.code:'OPERATION_UNAVAILABLE'});return reply(known?error.status:503,{error:known?error.code:'OPERATION_UNAVAILABLE'});}}
   // Foundation remains a safe, independently deployable stop state.
   return reply(req.url?.startsWith('/v1/')?503:404,{status:req.url?.startsWith('/v1/')?'CAPABILITY_NOT_ACTIVATED':'NOT_FOUND'});
 });
}
