import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {selectConversationContext,contextHistoryScopes,contextSatisfiesScope,referenceIdentity} from '../lib/assistant/context-selection';
import type {PublishedReportReference,NewsfeedReference} from '../../../packages/assistant-context-contracts/src/index.mjs';
const report:PublishedReportReference={version:'2.1.0',source:'PUBLISHED_REPORT',producerJobId:randomUUID(),pdfSha256:'a'.repeat(64),markdownSha256:'b'.repeat(64)};
test('PI explicitly selects one published edition without starting another planner, report or Forecast',()=>{
 const selection=selectConversationContext({message:'Jak interpretować prognozę w tym raporcie?',locale:'pl',module:'procurement_insights',reference:report},null,randomUUID());
 assert.deepEqual(selection.policy.contextPlan,[{source:'PUBLISHED_REPORT',selection:'ACTIVE_VIEW'}]);assert.equal(selection.references[0],report);
 const entry={source:'PUBLISHED_REPORT',status:'OK' as const,sourceVersion:'SYNTHETIC_HASH',data:{producerJobId:report.producerJobId}};
 const scopes=contextHistoryScopes(selection,[entry],randomUUID());assert.equal(scopes.length,1);assert.equal(contextSatisfiesScope(scopes[0],entry),true);
 for(const changed of[{...entry,status:'DENIED' as const},{...entry,status:'STALE' as const},{...entry,sourceVersion:'OTHER_VERSION'}])assert.equal(contextSatisfiesScope(scopes[0],changed),false);
});
test('a selected stored Newsfeed run and publication remain exact; switching versions changes conversation scope',()=>{
 const reference:NewsfeedReference={version:'2.1.0',source:'NEWSFEED',observationId:randomUUID(),supplierNip:null,runId:randomUUID(),publicationId:randomUUID()};
 const selection=selectConversationContext({message:'Co wynika z tej publikacji?',locale:'pl',module:'procurement_insights',reference},null,randomUUID());
 assert.deepEqual(selection.references,[reference]);assert.deepEqual(selection.policy.contextPlan,[{source:'NEWSFEED',selection:'ACTIVE_VIEW'}]);assert.notEqual(referenceIdentity(reference),referenceIdentity({...reference,runId:randomUUID()}));
});
