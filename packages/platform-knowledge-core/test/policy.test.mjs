import {test} from 'node:test';import assert from 'node:assert/strict';
import {eligibleSource,sourceCoverage,quoteMaximumCost,assertBudgetReservation} from '../src/policy.mjs';
const p={environment:'development',internalUserId:'user-a',organisationIds:['org-a'],usePurpose:'CUSTOMER_SERVICE',sharedKnowledgeAllowed:true};
const s={environment:'development',scope:'ACCOUNT_PRIVATE',ownerUserId:'user-a',ownerOrganisationId:null,status:'CURRENT',rights:{classification:'UNKNOWN',purpose:'PRIVATE',organisationConstraintId:null,externalAiAllowed:true,quotingAllowed:true,apiExcerptAllowed:true}};
test('private user ownership never implies organisation sharing or changes source restrictions',()=>{
 assert.equal(eligibleSource(s,p,'context'),true);
 assert.equal(eligibleSource(s,{...p,internalUserId:'user-b'},'context'),false);
 assert.equal(eligibleSource({...s,ownerOrganisationId:'org-a'},p,'context'),false);
 const restricted={...s,rights:{...s.rights,classification:'CONFIDENTIAL',organisationConstraintId:'org-a'}};
 assert.equal(eligibleSource(restricted,p,'context'),true);
 assert.equal(eligibleSource(restricted,{...p,organisationIds:['org-b']},'context'),false);
 assert.equal(eligibleSource({...s,scope:'PROFITIA_SHARED',published:true},p,'context'),false);
 assert.equal(s.rights.organisationConstraintId,null);
});
test('revocation, expiry, environment and separate usage rights fail closed',()=>{
 for(const patch of [{revokedAt:'now'},{deletedAt:'now'},{expiresAt:'bad'},{expiresAt:'2020-01-01'},{environment:'production'},{status:'WITHDRAWN'}])assert.equal(eligibleSource({...s,...patch},p,'context'),false);
 for(const [use,flag] of [['externalAi','externalAiAllowed'],['quote','quotingAllowed'],['apiExcerpt','apiExcerptAllowed']])assert.equal(eligibleSource({...s,rights:{...s.rights,[flag]:false}},p,use),false);
});
test('coverage detects last page, failure and duplicate attribution',()=>{
 assert.deepEqual(sourceCoverage(['p1','p2'],[{unitId:'p1',status:'COMPLETE'}]).missing,['p2']);
 assert.equal(sourceCoverage(['p1'],[{unitId:'p1',status:'FAILED'}]).status,'PARTIAL');
 assert.throws(()=>sourceCoverage(['p1'],[{unitId:'p1',status:'COMPLETE'},{unitId:'p1',status:'COMPLETE'}]));
 assert.equal(sourceCoverage(['p1'],[{unitId:'p1',status:'COMPLETE'}]).status,'COMPLETE');
});
test('finite budget includes outstanding reservations and rejects unknown ledger',()=>{
 const next=quoteMaximumCost({inputTokens:16000,outputTokens:4000,embeddingTokens:10000});assert.ok(next>0);
 const ledger={spentMicrousd:0,reservedMicrousd:0,documentSpentMicrousd:0,documentReservedMicrousd:0,nextMicrousd:next};assertBudgetReservation(ledger);
 assert.throws(()=>assertBudgetReservation({...ledger,reservedMicrousd:10000000}));
 assert.throws(()=>assertBudgetReservation({...ledger,documentReservedMicrousd:1000000}));
 assert.throws(()=>assertBudgetReservation({...ledger,spentMicrousd:NaN}));
 assert.throws(()=>quoteMaximumCost({inputTokens:1000000,outputTokens:1,embeddingTokens:0}));
});
