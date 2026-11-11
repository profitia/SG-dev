import test from 'node:test';import assert from 'node:assert/strict';
import {chunkDocument,reconstructSource} from '../src/chunking.mjs';
import {fuseCandidates,queryIdentifiers} from '../src/ranking.mjs';
import {fitContext,fitContextAsync} from '../src/context.mjs';
const tokens=s=>Array.from(s).length;
test('all Unicode, long sentences and unpunctuated tails survive bounded chunking and reconstruction',()=>{
 for(const sample of ['a'.repeat(10000)+'TAIL','αβ🙂\u0301\n中文'.repeat(800),'A long sentence. '+('word '.repeat(3000))+'END_WITHOUT_PUNCTUATION']){
  const result=chunkDocument([{id:'p1',kind:'PAGE',ordinal:1,status:'COMPLETE',text:sample}],{countTokens:tokens,maxTokens:64});
  assert.equal(reconstructSource(result.chunks,result.sourceDigest),sample);assert.ok(result.chunks.every(c=>c.tokenCount<=64));
  assert.equal(result.coverage.extractedCharacters,result.coverage.chunkedCharacters);
  const corrupted=result.chunks.map(c=>({...c}));corrupted[0].text+='x';assert.throws(()=>reconstructSource(corrupted,result.sourceDigest));
 }
});
test('inventory includes failed and blank pages; locations retain original ordinals',()=>{
 const r=chunkDocument(Array.from({length:100},(_,i)=>({id:'p'+i,kind:'PAGE',ordinal:i+1,status:i===20?'FAILED':'COMPLETE',text:i===20?'':i===99?'LAST_PAGE_100':'page '+i})),{countTokens:tokens,maxTokens:64});
 assert.equal(r.units.length,100);assert.deepEqual(r.coverage.failedUnitIds,['p20']);assert.ok(r.chunks.some(c=>c.locations.some(l=>l.ordinal===100)));
 assert.equal(r.chunks.map(c=>c.text).join(''),Array.from({length:100},(_,i)=>i===20?'':i===99?'LAST_PAGE_100':'page '+i).join('\n\n'));
});
test('hybrid fusion deduplicates and exact identifiers remain literal business text',()=>{
 const r=fuseCandidates({semantic:[{id:'a'},{id:'b'}],lexical:[{id:'b'}],exact:[{id:'c'}]});assert.equal(r[0].id,'c');assert.equal(r.length,3);
 assert.deepEqual(queryIdentifiers('What applies to CPV 30190000-7 and ISO 9001:2015?'),['30190000-7','ISO 9001:2015']);
});
test('complete envelope budget removes whole items and names material omissions',()=>{
 const q={requestId:'q',maxTokens:600,tokenizerId:'test-code-points',targetModel:'test-model'};
 const evidence=[{evidenceId:'a',text:'x'.repeat(300),coverage:'COMPLETE'},{evidenceId:'b',text:'y'.repeat(300),coverage:'COMPLETE'}];
 const r=fitContext(q,evidence,{countTokens:tokens});assert.equal(r.usedTokens,tokens(JSON.stringify(r)));assert.ok(r.usedTokens<=q.maxTokens);assert.deepEqual(r.omissions,['BUDGET']);assert.equal(r.evidence[0].text,evidence[0].text);assert.equal(r.evidence.length,1);
 assert.throws(()=>fitContext({...q,maxTokens:1},[],{countTokens:tokens}),/CONTEXT_BUDGET_TOO_SMALL/);
});

test('async full-envelope budget never leaves a synthesis with missing evidence references',async()=>{
 const q={version:'0.2.0',requestId:'q',maxTokens:650,tokenizerId:'test',targetModel:'test'};
 const evidence=[{evidenceId:'a',text:'A'.repeat(240),coverage:'COMPLETE'},{evidenceId:'b',text:'B'.repeat(240),coverage:'COMPLETE'}];
 const summary={text:'Generated synthesis',generated:true,expectedUnits:2,coveredUnitIds:['1','2'],missingUnitIds:[],evidenceIds:['a','b']};
 const result=await fitContextAsync(q,evidence,{version:q.version,summary,countTokens:async text=>tokens(text)});
 assert.equal(result.usedTokens,tokens(JSON.stringify(result)));assert.ok(result.usedTokens<=q.maxTokens);
 if(result.summary)assert.ok(result.summary.evidenceIds.every(id=>result.evidence.some(e=>e.evidenceId===id)));
 else assert.ok(result.omissions.includes('SUMMARY_INCOMPLETE'));
});
