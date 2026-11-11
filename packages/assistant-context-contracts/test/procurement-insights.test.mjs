import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readContextReference,readContextSelection} from '../src/index.mjs';
test('private selection identifiers are closed; legacy references remain compatible',()=>{
 const news={version:'2.1.0',source:'NEWSFEED',observationId:randomUUID(),supplierNip:null,runId:randomUUID(),publicationId:randomUUID()},report={version:'2.1.0',source:'PUBLISHED_REPORT',producerJobId:randomUUID(),pdfSha256:'a'.repeat(64),markdownSha256:'b'.repeat(64)};
 for(const ref of[news,report]){assert.deepEqual(readContextReference(ref),ref);for(const extra of[{userId:randomUUID()},{organisationId:randomUUID()},{allow:true},{content:'UNTRUSTED'}])assert.throws(()=>readContextReference({...ref,...extra}))}
 assert.throws(()=>readContextReference({...news,observationId:null}));assert.throws(()=>readContextReference({...report,pdfSha256:'wrong'}));assert.throws(()=>readContextSelection({version:'2.0.0',source:'CONTEXT_SELECTION',references:[report,report]}));
 assert.deepEqual(readContextReference({version:'2.0.0',source:'NEWSFEED',observationId:null,supplierNip:null}),{version:'2.0.0',source:'NEWSFEED',observationId:null,supplierNip:null});
});
