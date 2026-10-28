import test from 'node:test';import assert from 'node:assert/strict';
import {validateXRayData,validateXRayCommand,XRAY_OPERATIONS,XRAY_WORKFLOW_CONTRACT,unwrapXRayResponse,readXRayJson} from '@profitia/srm-xray/workflow-contract';
import {sampleCard} from '../src/demo/fixture';
const publicCard={...sampleCard,kys:{...sampleCard.kys,status:'NOT_REQUESTED' as const,data:null}};
test('source is genuinely optional on the versioned wire, never fabricated by the presentation contract',()=>{
 const card=structuredClone(publicCard);for(const section of [card.general,card.financial,card.kys])delete (section as {source?:unknown}).source;
 const value={entityType:'COMPANY',card};validateXRayData('search',value);assert(!Object.hasOwn(card.general,'source'));
 for(const status of ['SUCCESS','EMPTY','PARTIAL','ERROR','NOT_REQUESTED','PENDING']){card.general.status=status as typeof card.general.status;validateXRayData('search',value);}
});
test('the version, operation, public shape and exact command boundary are independently checked',()=>{
 assert.equal(Object.keys(XRAY_OPERATIONS).length,5);validateXRayCommand('search',{identifier:'0000000000'});
 for(const value of [{identifier:'0000000000',organisationId:'foreign'},{identifier:'bad'},{userId:'forged'},null])assert.throws(()=>validateXRayCommand('search',value));
 const envelope={contract:XRAY_WORKFLOW_CONTRACT,operation:'search',requestId:'11111111-1111-4111-8111-111111111111',data:{entityType:'COMPANY',card:publicCard}};
 assert.deepEqual(unwrapXRayResponse('search',envelope,200),envelope.data);
 assert.throws(()=>unwrapXRayResponse('kys',envelope,200));assert.throws(()=>unwrapXRayResponse('search',{...envelope,contract:{...XRAY_WORKFLOW_CONTRACT,version:'2.0.0'}},200));
 for(const bad of [{...sampleCard,general:{...sampleCard.general,warnings:'bad'}},{...sampleCard,financial:{...sampleCard.financial,data:{periods:[{facts:null}]}}}])assert.throws(()=>validateXRayData('search',{entityType:'COMPANY',card:bad}));
});
test('wire size, encoding, media type and cancellation are bounded',async()=>{
 await assert.rejects(readXRayJson(Response.json({data:'oversize'}),5));await assert.rejects(readXRayJson(new Response('{}')));
 const aborted=new AbortController();aborted.abort();await assert.rejects(readXRayJson(Response.json({}),1024,aborted.signal));
 assert.deepEqual(await readXRayJson(Response.json({ok:true})),{ok:true});
});


test('oversize cloned bodies return promptly without awaiting cancellation of an unread tee sibling',async()=>{
 const request=new Request('https://synthetic.invalid',{method:'POST',body:JSON.stringify({text:'x'.repeat(3000)})});
 await Promise.race([assert.rejects(readXRayJson(new Response(request.clone().body,{headers:{'content-type':'application/json'}}),5)),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('bounded read hung')),200);timer.unref();})]);
 void request.body?.cancel();
});

import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {peerOperationSourceDigest} from '@profitia/platform-contracts/peer-operation';
test('X-Ray acceptance is additive, preserves every historical receipt and binds current public/source/consumer closures',async()=>{
 const root=new URL('../../../',import.meta.url),receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url),'utf8')),a=receipt.appshellXraySourceCompatibility;
 const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
 const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json']);assert.equal(hash(prior),a.previousReceiptDigest);
 for(const[key,value]of Object.entries(JSON.parse(prior.toString())))assert.deepEqual(receipt[key],value,key);
 assert.equal(a.platformVersion,'1.30.0');assert.equal(a.architectureProducer.pullRequest,773);assert.equal(a.architectureProducer.peerOperationDigest,await peerOperationSourceDigest());
 assert.equal(a.publicUi.version,'0.3.0');assert.equal(a.publicUi.contractVersion,'1.0.0');
 const publicRoot=new URL('packages/srm-xray/',root),digest=createHash('sha256');for(const file of a.publicUi.sourceFiles)digest.update(file).update('\0').update(fs.readFileSync(new URL(file,publicRoot))).update('\0');assert.equal(digest.digest('hex'),a.publicUi.sourceDigest);
 for(const [file,digest]of Object.entries({...a.publicSourceDigests,...a.repositorySourceDigests}))assert.equal(hash(fs.readFileSync(new URL(file,root))),digest,file);
 for(const [file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),digest,file);
 for(const flag of ['identitySourceChanged','operationContractChanged','existingPeerReadChanged','grantsOrMembershipChanged','schemaOrInfrastructureChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag);
});
