import test from 'node:test';
import assert from 'node:assert/strict';
import {createPeerOperationSigner,hasVerifiedPeerOperation} from '@profitia/platform-contracts/peer-operation';
import {PRESENTATION_ROUTES,validatePresentationCommand,validatePresentationResult,readPresentationBytes} from '@profitia/srm-xray/full-report-operations';
import {readSrmPeerXRayConfiguration} from './peer-xray';
import {presentationPeerRoutes,withSrmPresentationPeer} from './peer-xray-presentation';
import {buildFinancialExcel} from './financial-excel';
import {projectFinancialDocuments} from './financial-documents';
import type {FinancialData} from '@profitia/srm-xray';
const env={PROFITIA_XRAY_PEER_VERSION:'1.0.0',TARGET_ENVIRONMENT:'development',PROFITIA_AUTH_PROVIDER:'clerk',RENDER_SERVICE_ID:'srv-db1vu6gm7kps73d0e3r0',PROFITIA_XRAY_PEER_KEY_ID:'synthetic-test',PROFITIA_XRAY_PEER_KEY:Buffer.alloc(32,42).toString('base64url')};
const config={...readSrmPeerXRayConfiguration(env)!,routes:presentationPeerRoutes(),internalOrigins:[]};
const sign=createPeerOperationSigner(config);
const request=(path:string,body:unknown)=>new Request(config.targetOrigin+path,{method:'POST',headers:{authorization:'Bearer synthetic-user','content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify(body)});
test('presentation peer refuses unsigned, foreign commands and tampered body before native E1 is entered',async()=>{
 let calls=0;const handler=withSrmPresentationPeer(async()=>{calls++;return Response.json({candidates:[],coverage:'PROGRESSIVE'})},env),path=PRESENTATION_ROUTES.registrySearch.path;
 assert.equal((await handler(request(path,{query:'Fixture'}))).status,403);
 assert.equal((await handler(await sign(request(path,{query:'Fixture',organisationId:'foreign'})))).status,400);
 const signed=await sign(request(path,{query:'Fixture'}));
 assert.equal((await handler(new Request(signed.url,{method:'POST',headers:signed.headers,body:JSON.stringify({query:'Changed'})}))).status,403);
 assert.equal(calls,0);
});
test('verified transport proof is retained on the original native request; a denied native operation stays denied',async()=>{
 let body:unknown;
 const handler=withSrmPresentationPeer(async r=>{assert(hasVerifiedPeerOperation(r));body=await r.json();return Response.json({error:'denied'},{status:403})},env);
 const response=await handler(await sign(request(PRESENTATION_ROUTES.registrySearch.path,{query:'Fixture'})));
 assert.deepEqual(body,{query:'Fixture'});assert.equal(response.status,403);assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(await response.json(),{error:'XRAY_ACCESS_DENIED'});
});
test('existing financial generator returns a real workbook unchanged across the presentation peer',async()=>{
 const data:FinancialData={periods:[{from:'2025-01-01',to:'2025-12-31',scope:'standalone',documentId:'doc-1:cfy',facts:[{metricCode:'BS_A_TA',amount:'123',unit:'PLN',currency:'PLN'}]}]};
 const documents=projectFinancialDocuments([{id:'doc-1',document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',is_ias_compliant:false},content:{schema:{name:'JednostkaInnaWZlotych',version:'1-3'},extracted_fields:{'Bilans.Aktywa.KwotaA':'123','RZiS.RZiSKalk.A.KwotaA':'456'}}}]);
 const workbook=await buildFinancialExcel(data,{nip:'8521021463',scope:'standalone',years:['2025']},new Date('2026-10-31'),documents);
 const handler=withSrmPresentationPeer(async r=>{assert(hasVerifiedPeerOperation(r));return new Response(new Uint8Array(workbook.bytes),{headers:{'content-type':PRESENTATION_ROUTES.financialExcel.mime,'X-Download-Filename':workbook.filename}})},env);
 const response=await handler(await sign(request(PRESENTATION_ROUTES.financialExcel.path,{nip:'8521021463',scope:'standalone',years:['2025']})));
 assert.equal(response.status,200);assert.equal(response.headers.get('X-Download-Filename'),workbook.filename);
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array(workbook.bytes));
});
test('binary format, maximum bytes, filenames, selected years and private disclosure projection are bounded',async()=>{
 assert.throws(()=>validatePresentationCommand('financialExcel',{nip:'8521021463',scope:'standalone',years:['2025','2025']}));
 assert.throws(()=>validatePresentationCommand('mapReadiness',{supplierId:'foreign',organisationId:'tenant'}));
 assert.throws(()=>validatePresentationResult('revealPesel',new TextEncoder().encode(JSON.stringify({pesel:'12345678901',raw:'private'})),'application/json',null));
 assert.throws(()=>validatePresentationResult('kysPdf',new TextEncoder().encode('<html>error</html>'),'application/pdf','KYS_8521021463.pdf'));
 assert.throws(()=>validatePresentationResult('financialExcel',new TextEncoder().encode('PK123'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','../../foreign.xlsx'));
 await assert.rejects(readPresentationBytes(new Response('12345'),4));
 validatePresentationResult('financialExcel',new TextEncoder().encode('PK123'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Financials_MSR_8521021463_20261031.xlsx');
});
