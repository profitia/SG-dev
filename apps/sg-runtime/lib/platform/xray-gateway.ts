import {validRequestIdempotencyKey} from '@profitia/platform-contracts/request-ledger';
import {createPeerOperationSigner,type PeerOperationConfiguration} from '@profitia/platform-contracts/peer-operation';
import {createPublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request';
import {XRAY_OPERATIONS,XRAY_WORKFLOW_CONTRACT,XRAY_REQUEST_BYTES,XRAY_RESPONSE_BYTES,readXRayJson,validateXRayCommand,unwrapXRayResponse,type XRayOperation} from '@profitia/srm-xray/workflow-contract';
import {readSelfServiceAccountConfiguration} from './account-session';
type Environment=Readonly<Record<string,string|undefined>>;
const sourceOrigin='https://dev-sg2.spendguru.app',targetOrigin='https://srm-development-runtime.onrender.com',identityOrigin='https://identity-runtime-development.onrender.com';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization, Origin','X-Content-Type-Options':'nosniff'};
function failure(operation:XRayOperation,status:number,code:string){return Response.json({contract:XRAY_WORKFLOW_CONTRACT,operation,requestId:crypto.randomUUID(),error:{code}},{status,headers});}
export function readAppShellXRayConfiguration(env:Environment=process.env):PeerOperationConfiguration|null {
 if(env.PROFITIA_XRAY_PEER_VERSION===undefined)return null;
 const account=readSelfServiceAccountConfiguration(env),key=env.PROFITIA_XRAY_PEER_KEY,keyId=env.PROFITIA_XRAY_PEER_KEY_ID;
 if(env.PROFITIA_XRAY_PEER_VERSION!=='1.0.0'||env.TARGET_ENVIRONMENT!=='development'||env.RENDER_SERVICE_ID!=='srv-dapa3tid0e5s73f8bc5g'||!account||account.publicOrigin!==sourceOrigin||account.runtimeOrigin!==identityOrigin||!keyId||!key||!/^[A-Za-z0-9_-]{43,86}$/.test(key)||Buffer.from(key,'base64url').toString('base64url')!==key||key===env.PROFITIA_CLERK_SECRET_KEY)throw Error('XRAY_UNAVAILABLE');
 return {environment:'development',callerApplicationId:'spendguru',receiverApplicationId:'srm',sourceOrigin,targetOrigin,keyId,key:new Uint8Array(Buffer.from(key,'base64url')),
 routes:Object.values(XRAY_OPERATIONS).map(path=>({method:'POST',path,maximumRequestBytes:XRAY_REQUEST_BYTES,requireIdempotencyKey:true})),internalOrigins:[]};
}
/** Fixed mapping. Identity confirms the current end-user account; SRM then
 * authenticates that same captured bearer and independently checks current E1,
 * product, tenant and resource rights. No ALLOW/session proof is cached here. */
export function createXRayGateway({env=process.env,transport=fetch,now=Date.now}:{env?:Environment;transport?:typeof fetch;now?:()=>number}={}){
 return async(request:Request,operationName:string):Promise<Response>=>{
  if(!Object.hasOwn(XRAY_OPERATIONS,operationName))return Response.json({error:'Not found'},{status:404,headers});
  const operation=operationName as XRayOperation;
  if(request.method!=='POST')return failure(operation,405,'XRAY_REQUEST_INVALID');
  const authorization=request.headers.get('authorization');
  if(!authorization||!/^Bearer [\x21-\x7e]{1,16384}$/i.test(authorization))return failure(operation,401,'XRAY_SESSION_REQUIRED');
  let config:PeerOperationConfiguration|null;
  try{config=readAppShellXRayConfiguration(env);}catch{return failure(operation,503,'XRAY_UNAVAILABLE');}
  if(!config)return failure(operation,503,'XRAY_UNAVAILABLE');
  const normalized=createPublicIdentityRequestBoundary({publicOrigins:[sourceOrigin],internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000','http://localhost:10000','https://localhost:10000']})(request);
  if(!normalized||normalized.headers.get('origin')!==sourceOrigin||request.headers.has('cookie')||new URL(normalized.url).pathname!=='/api/appshell/xray/'+operation||new URL(normalized.url).search||new URL(normalized.url).hash)return failure(operation,403,'XRAY_ACCESS_DENIED');
  const key=request.headers.get('idempotency-key');
  if(!validRequestIdempotencyKey(key))return failure(operation,400,'XRAY_REQUEST_INVALID');
  const timeout=AbortSignal.timeout(55_000),signal=AbortSignal.any([request.signal,timeout]);
  let command:unknown;
  try{command=await readXRayJson(new Response(request.body,{headers:{'content-type':request.headers.get('content-type')??''}}),XRAY_REQUEST_BYTES,signal);validateXRayCommand(operation,command);}
  catch{return failure(operation,400,'XRAY_REQUEST_INVALID');}
  try{
   // Existing public own-account read, using the original bearer and no cookies.
   const readAccount=async():Promise<{userId:string;expiresAt:string}|Response>=>{
    const accountSignal=AbortSignal.any([signal,AbortSignal.timeout(4000)]);
    const account=await transport(identityOrigin+'/v1/account',{method:'GET',headers:{authorization},credentials:'omit',cache:'no-store',redirect:'error',signal:accountSignal});
    if(!account.ok){void account.body?.cancel();return failure(operation,account.status===401?401:account.status===403?403:503,account.status===401?'XRAY_SESSION_REQUIRED':account.status===403?'XRAY_ACCESS_DENIED':'XRAY_UNAVAILABLE');}
    const proof=await readXRayJson(account,4096,accountSignal);
    if(!proof||Object.getPrototypeOf(proof)!==Object.prototype||Object.keys(proof).sort().join(',')!=='authenticated,expiresAt,userId')return failure(operation,503,'XRAY_UNAVAILABLE');
    const current=proof as Record<string,unknown>;
    if(current.authenticated!==true||typeof current.userId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(current.userId)||typeof current.expiresAt!=='string'||!(Date.parse(current.expiresAt)>now())||signal.aborted)return failure(operation,401,'XRAY_SESSION_REQUIRED');
    return {userId:current.userId,expiresAt:current.expiresAt};
   };
   const current=await readAccount();if(current instanceof Response)return current;
   const correlationId=crypto.randomUUID();
   const outgoing=await createPeerOperationSigner(config,{newRequestId:()=>correlationId})(new Request(targetOrigin+XRAY_OPERATIONS[operation],{method:'POST',headers:{authorization,'content-type':'application/json','idempotency-key':key},body:JSON.stringify(command),signal}));
   const response=await transport(outgoing);
   if(response.redirected)return failure(operation,502,'XRAY_RESPONSE_INVALID');
   const payload=await readXRayJson(response,XRAY_RESPONSE_BYTES,signal);unwrapXRayResponse(operation,payload,response.status);
   if(response.ok&&(payload as {requestId:string}).requestId!==correlationId)return failure(operation,502,'XRAY_RESPONSE_INVALID');
   if(signal.aborted)return failure(operation,504,'XRAY_INTERRUPTED');
   if(response.ok&&Date.parse(current.expiresAt)<=now()){
    // A slow provider cannot turn a short account proof into a cached ALLOW.
    // Refresh only authority, never repeat the SRM/provider operation.
    const renewed=await readAccount();if(renewed instanceof Response)return renewed;
    if(renewed.userId!==current.userId)return failure(operation,403,'XRAY_ACCESS_DENIED');
    if(signal.aborted||Date.parse(renewed.expiresAt)<=now())return failure(operation,401,'XRAY_SESSION_REQUIRED');
   }
   const safeHeaders=new Headers(headers);safeHeaders.set('X-Profitia-Correlation-Id',correlationId);const requestId=response.headers.get('X-SRM-Request-Id');if(requestId&&/^[a-f0-9-]{36}$/.test(requestId))safeHeaders.set('X-SRM-Request-Id',requestId);
   const mode=response.headers.get('X-SRM-KYS-Mode');if(mode&&['PROVIDER','CACHE','FOLLOWER'].includes(mode))safeHeaders.set('X-SRM-KYS-Mode',mode);
   return Response.json(payload,{status:response.status,headers:safeHeaders});
  }catch{return failure(operation,signal.aborted?504:502,signal.aborted?'XRAY_INTERRUPTED':'XRAY_UNAVAILABLE');}
 };
}
