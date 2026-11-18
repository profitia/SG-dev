import {test} from 'node:test';import assert from 'node:assert/strict';
import {createKnowledgeContextAdapter} from '../src/knowledge.mjs';
const query={version:'0.2.0',requestId:'q',task:'ANSWER',query:'Jak długo potrwa dostawa?',language:'pl',scopes:['PROFITIA_SHARED','ACCOUNT_PRIVATE'],maxTokens:400,tokenizerId:'fixture',targetModel:'fixture'};
const result={version:'0.2.0',requestId:'q',status:'INSUFFICIENT_EVIDENCE',evidence:[],usedTokens:80,tokenizerId:'fixture',targetModel:'fixture',omissions:[],continuation:null};
test('CIC demand family reaches actual PK adapter without ACTIVE_VIEW or source-id hints',async()=>{
 const request=new Request('https://host.synthetic.test/assistant');let calls=0;
 const adapter=createKnowledgeContextAdapter({query:async input=>{calls++;assert.equal(input.request,request);assert.equal(input.query.documentIds,undefined);return result;},countTokens:async()=>80,validateSchema:()=>true});
 assert.deepEqual(await adapter.resolve({plan:{source:'PLATFORM_KNOWLEDGE',selection:'KNOWLEDGE_QUERY',query},request}),result);assert.equal(calls,1);
 await assert.rejects(adapter.resolve({plan:{source:'PLATFORM_KNOWLEDGE',selection:'KNOWLEDGE_QUERY',query:{...query,userId:'someone'}},request}));
});
test('adapter rejects schema failures, token overflow and missing trusted request',async()=>{
 const request=new Request('https://host.synthetic.test/assistant');const plan={source:'PLATFORM_KNOWLEDGE',selection:'KNOWLEDGE_QUERY',query};
 for(const ports of [{validateSchema:()=>false,countTokens:()=>80},{validateSchema:()=>true,countTokens:()=>500}]){
  const a=createKnowledgeContextAdapter({query:async()=>result,...ports});await assert.rejects(a.resolve({plan,request}));
 }
 const a=createKnowledgeContextAdapter({query:async()=>result,validateSchema:()=>true,countTokens:()=>80});await assert.rejects(a.resolve({plan,request:{userId:'claimed'}}));
});
