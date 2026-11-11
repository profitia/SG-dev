import {test} from 'node:test';import assert from 'node:assert/strict';import {CONTRACT,assertQuery,assertContextSemantics} from '../index.mjs';
test('v0.2 distinguishes generated whole-document synthesis from literal evidence',()=>{
 const q={version:CONTRACT.version,requestId:'s',task:'DOCUMENT_SUMMARY',query:'Podsumuj',language:'pl',scopes:['PROFITIA_SHARED'],documentIds:['doc'],maxTokens:200,tokenizerId:'fixture',targetModel:'fixture'};
 assertQuery(q);
 const r={version:q.version,requestId:'s',status:'PARTIAL',evidence:[],usedTokens:100,tokenizerId:'fixture',targetModel:'fixture',omissions:['SOURCE_PARTIAL'],continuation:null,
  summary:{text:'Synthesis',generated:true,expectedUnits:2,coveredUnitIds:['page-1'],missingUnitIds:['page-2'],evidenceIds:[]}};
 assertContextSemantics(q,r,()=>100);
 assert.throws(()=>assertContextSemantics(q,{...r,summary:{...r.summary,coveredUnitIds:['page-1','page-2']}},()=>100));
 assert.throws(()=>assertContextSemantics(q,{...r,summary:{...r.summary,generated:false}},()=>100));
});
