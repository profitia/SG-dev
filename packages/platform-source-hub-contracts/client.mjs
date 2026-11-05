import {createFirstPartySourceSigner} from '@profitia/platform-current-e1-authority/first-party'
import {parseHubRequest,assertHubResponse,SourceHubError} from './index.mjs'

/** The same provider-independent client serves interactive modules and real
 * service jobs. Configuration is server-owned, never supplied by a browser. */
export function createFirstPartySourceHubClient(configuration,{fetchImpl=fetch,...signerDependencies}={}){
 const sign=createFirstPartySourceSigner(configuration,signerDependencies)
 return Object.freeze({async acquire({command,execution,idempotencyKey,request=null,signal=undefined}){
  const parsed=parseHubRequest(command)
  if(!execution||!['HUMAN','SERVICE'].includes(execution.kind)||typeof execution.organisationId!=='string'
   ||Object.keys(execution).some(k=>!['kind','organisationId','grantId'].includes(k))
   ||execution.kind==='SERVICE'&&typeof execution.grantId!=='string'||execution.kind==='HUMAN'&&execution.grantId!==undefined)throw new SourceHubError('INVALID_EXECUTION_CONTEXT')
  const credential=execution.kind==='HUMAN'&&request instanceof Request?request.headers.get('authorization'):null
  if(execution.kind==='HUMAN'&&!/^Bearer [\x21-\x7e]{1,16384}$/.test(credential??'')||execution.kind==='SERVICE'&&request?.headers.has('authorization'))throw new SourceHubError('EXECUTION_IDENTITY_REQUIRED',401)
  const abort=AbortSignal.any([AbortSignal.timeout(20000),...(signal?[signal]:[]),...(request?[request.signal]:[])])
  const body=JSON.stringify({context:{...execution},request:parsed})
  if(Buffer.byteLength(body)>16384)throw new SourceHubError('REQUEST_TOO_LARGE',413)
  const signed=await sign(new Request(configuration.targetOrigin+'/v1/acquire',{method:'POST',headers:{'content-type':'application/json','idempotency-key':idempotencyKey,...(credential?{authorization:credential}:{})},body,signal:abort}))
  try{
   const response=await fetchImpl(signed),reader=response.body?.getReader();if(!reader)throw new SourceHubError('SOURCE_HUB_INVALID_RESPONSE',502)
   let size=0;const chunks=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024)throw new SourceHubError('SOURCE_HUB_RESPONSE_TOO_LARGE',502);chunks.push(value)}}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
   const value=JSON.parse(Buffer.concat(chunks).toString('utf8'))
   if(!response.ok){const code=typeof value?.error?.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(value.error.code)?value.error.code:'SOURCE_HUB_UNAVAILABLE';throw new SourceHubError(code,[400,401,403,409,429,502,503,504].includes(response.status)?response.status:503)}
   return assertHubResponse(value,parsed)
  }catch(error){if(error instanceof SourceHubError)throw error;throw new SourceHubError(abort.aborted?'SOURCE_HUB_TIMEOUT':'SOURCE_HUB_UNAVAILABLE',abort.aborted?504:503)}
 }})
}
