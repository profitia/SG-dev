// Owner-only single admitted API probe. This file is never run by CI/build/start.
// It does not grant E1, Source, licence or budget authority and never calls a
// provider directly. Full consumer business acceptance uses Newsfeed API.
import {readFile,lstat} from 'node:fs/promises';
import {createPeerOperationSigner} from '@profitia/platform-contracts/peer-operation';
import {readConfiguration} from '../src/config.mjs';
import {peerConfiguration,validateProviderRequest} from '../src/server.mjs';
import {parseHubRequest,assertHubResponse,closed} from '../../../packages/platform-source-hub-contracts/index.mjs';
async function privateFile(path,max){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>max||(s.mode&0o077)!==0)throw Error('PRIVATE_LOCAL_FILE_REQUIRED');return readFile(path,'utf8');}
try{
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/.test(process.env.SOURCE_HUB_OWNER_PROBE_REFERENCE??''))throw Error('EXPLICIT_OWNER_PROBE_REFERENCE_REQUIRED');
 const c=readConfiguration(),token=(await privateFile(process.env.SOURCE_HUB_PROBE_BEARER_FILE,16384)).trim(),envelope=JSON.parse(await privateFile(process.env.SOURCE_HUB_PROBE_REQUEST_FILE,16384));
 if(!/^[-_A-Za-z0-9.]+$/.test(token)||!closed(envelope,['context','request'])||!closed(envelope.context,['organisationId','expectedUserId']))throw Error('INVALID_PROBE');
 const command=parseHubRequest(envelope.request);validateProviderRequest(command);
 const sign=createPeerOperationSigner(peerConfiguration(c)),request=await sign(new Request(c.publicOrigin+'/v1/acquire',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','idempotency-key':'owner-probe:'+process.env.SOURCE_HUB_OWNER_PROBE_REFERENCE},body:JSON.stringify(envelope),signal:AbortSignal.timeout(20000)}));
 const response=await fetch(request),reader=response.body?.getReader(),chunks=[];let size=0;if(!reader)throw Error('INVALID_RESPONSE');
 try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>2097152)throw Error('RESPONSE_TOO_LARGE');chunks.push(p.value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!response.ok)throw Error('PROBE_NOT_ACCEPTED');assertHubResponse(value,command);
 process.stdout.write(JSON.stringify({probe:'OPERATOR_TRANSPORT_PROBE_NOT_CONSUMER_E2E',ownerReference:process.env.SOURCE_HUB_OWNER_PROBE_REFERENCE,provider:value.provider,family:value.family,status:value.status,itemCount:value.items.length,receiptRef:value.usage.receiptRef,upstreamAttempts:value.usage.upstreamAttempts,filterEffectiveness:'REQUIRES_SEPARATE_RESULT_REVIEW'})+'\n');
}catch{process.stderr.write('{"probe":"REFUSED_OR_FAILED","liveVerification":"NOT_ESTABLISHED"}\n');process.exitCode=1;}
