import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schemas,assertQuery,assertContextSemantics} from '../index.mjs';
const q=()=>({version:'0.1.0',requestId:'req',task:'ANSWER',query:'Jak oceniać termin dostawy?',language:'pl',scopes:['PROFITIA_SHARED','ACCOUNT_PRIVATE'],maxTokens:4000,tokenizerId:'fixture',targetModel:'fixture'});
test('natural discovery does not need source identifiers; browser identity is rejected',()=>{
 assert.equal(assertQuery(q()).documentIds,undefined);
 for(const extra of [{userId:'other'},{principal:{allow:true}},{organisationId:'org'},{allow:true}]) assert.throws(()=>assertQuery({...q(),...extra}));
});
test('summary is one known document; memory is private; budgets and duplicate scopes fail',()=>{
 assert.throws(()=>assertQuery({...q(),task:'DOCUMENT_SUMMARY'}));
 assertQuery({...q(),task:'DOCUMENT_SUMMARY',documentIds:['doc']});
 assert.throws(()=>assertQuery({...q(),task:'MEMORY_RECALL'}));
 for(const maxTokens of [0,NaN,Infinity,1.5,16001]) assert.throws(()=>assertQuery({...q(),maxTokens}));
 assert.throws(()=>assertQuery({...q(),scopes:['ACCOUNT_PRIVATE','ACCOUNT_PRIVATE']}));
});
test('whole envelope is charged and nonusable results cannot carry evidence',()=>{
 const r={version:'0.1.0',requestId:'req',status:'EMPTY',evidence:[],usedTokens:7,tokenizerId:'fixture',targetModel:'fixture',omissions:[],continuation:null};
 assertContextSemantics(q(),r,serialized=>{assert.match(serialized,/continuation/);return 7;});
 assert.throws(()=>assertContextSemantics({...q(),maxTokens:6},r,()=>7));
 assert.throws(()=>assertContextSemantics(q(),{...r,status:'DENIED',evidence:[{}]},()=>7));
 assert.throws(()=>assertContextSemantics(q(),{...r,status:'READY'},()=>7));
});
test('all schemas are closed and lifecycle uses canonical identity without organisation ownership',()=>{
 for(const s of Object.values(schemas.$defs)){assert.equal(s.additionalProperties,false);assert.ok(s.required.length);}
 assert.equal(schemas.$defs.AccountDeletionCommand.properties.scope.const,'ACCOUNT_PRIVATE_ALL');
 assert.equal(schemas.$defs.AccountDeletionCommand.properties.organisationId,undefined);
 assert.equal(schemas.$defs.Rights.properties.classification.enum[0],'UNKNOWN');
});
