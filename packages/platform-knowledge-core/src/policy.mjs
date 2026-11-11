export const LIMITS=Object.freeze({originalRetentionHours:24,memoryRetentionDays:180,maxFileBytes:52428800,maxPages:500,maxExtractedCharacters:2000000,workerConcurrency:1,maxJobMinutes:30,maxAttempts:3,maxModelInputTokens:16384,maxModelOutputTokens:4096,totalBudgetMicrousd:10000000,documentBudgetMicrousd:1000000});
export const PROVIDER=Object.freeze({provider:'openai',cognitiveModel:'gpt-6-luna',embeddingModel:'text-embedding-3-small',embeddingDimensions:1536,store:false,automaticPaidRetry:false,pricingVerifiedAt:'2026-11-11',inputUsdPerMillion:0.10,outputUsdPerMillion:0.50,embeddingUsdPerMillion:0.02});

// Pure policy, called only AFTER the server's real Identity/E1 verification.
// This function does not authenticate a user or mint operation admission.
export function eligibleSource(source,principal,use,now=Date.now()){
 if(!source||!principal||!['context','externalAi','quote','apiExcerpt'].includes(use))return false;
 if(!['development','staging','production'].includes(principal.environment)
   ||source.environment!==principal.environment||source.revokedAt||source.deletedAt
   ||!['CURRENT','REFERENCE','HISTORICAL'].includes(source.status))return false;
 if(source.expiresAt && (!Number.isFinite(Date.parse(source.expiresAt))||Date.parse(source.expiresAt)<=now))return false;
 if(source.scope==='ACCOUNT_PRIVATE'){
   if(!principal.internalUserId||source.ownerUserId!==principal.internalUserId||source.ownerOrganisationId!==null)return false;
 }else if(source.scope==='PROFITIA_SHARED'){
   if(source.published!==true||!principal.sharedKnowledgeAllowed)return false;
 }else return false;
 const r=source.rights;
 if(!r||!['UNKNOWN','PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'].includes(r.classification))return false;
 // Source restrictions survive private ownership and organisation changes.
 if(r.organisationConstraintId!==null && (!r.organisationConstraintId
   ||!principal.organisationIds?.includes(r.organisationConstraintId)))return false;
 if(r.purpose==='PRIVATE' && source.scope!=='ACCOUNT_PRIVATE')return false;
 if(r.purpose==='PROFITIA_INTERNAL' && principal.usePurpose!=='PROFITIA_INTERNAL')return false;
 if(!['PRIVATE','PROFITIA_INTERNAL','CUSTOMER_SERVICE'].includes(r.purpose))return false;
 if(r.classification==='UNKNOWN' && source.scope!=='ACCOUNT_PRIVATE')return false;
 if(use==='externalAi' && r.externalAiAllowed!==true)return false;
 if(use==='quote' && r.quotingAllowed!==true)return false;
 if(use==='apiExcerpt' && r.apiExcerptAllowed!==true)return false;
 return true;
}

export function sourceCoverage(expectedUnits,outcomes){
 if(!Array.isArray(expectedUnits)||!expectedUnits.length||expectedUnits.some(id=>typeof id!=='string'||!id)
   ||new Set(expectedUnits).size!==expectedUnits.length
   ||!Array.isArray(outcomes)||outcomes.some(o=>!expectedUnits.includes(o.unitId))
   ||new Set(outcomes.map(o=>o.unitId)).size!==outcomes.length)throw new TypeError('INVALID_COVERAGE_MANIFEST');
 const complete=new Set(outcomes.filter(o=>o.status==='COMPLETE').map(o=>o.unitId));
 const missing=expectedUnits.filter(id=>!complete.has(id));
 return {status:missing.length?'PARTIAL':'COMPLETE',expectedUnits:expectedUnits.length,accountedUnits:outcomes.length,missing};
}

export function quoteMaximumCost({inputTokens,outputTokens,embeddingTokens}){
 if([inputTokens,outputTokens,embeddingTokens].some(x=>!Number.isSafeInteger(x)||x<0)
  ||inputTokens>LIMITS.maxModelInputTokens||outputTokens>LIMITS.maxModelOutputTokens)throw new TypeError('INVALID_COST_RESERVATION');
 // Upper bound: no cache discount; allow cache-write and regional premiums.
 return Math.ceil((inputTokens*PROVIDER.inputUsdPerMillion*1.25+outputTokens*PROVIDER.outputUsdPerMillion+embeddingTokens*PROVIDER.embeddingUsdPerMillion)*1.1);
}
export function assertBudgetReservation({spentMicrousd,reservedMicrousd,documentSpentMicrousd,documentReservedMicrousd,nextMicrousd}){
 if([spentMicrousd,reservedMicrousd,documentSpentMicrousd,documentReservedMicrousd,nextMicrousd].some(n=>!Number.isSafeInteger(n)||n<0))throw new TypeError('INVALID_LEDGER');
 if(spentMicrousd+reservedMicrousd+nextMicrousd>LIMITS.totalBudgetMicrousd
   ||documentSpentMicrousd+documentReservedMicrousd+nextMicrousd>LIMITS.documentBudgetMicrousd)throw new Error('BUDGET_EXCEEDED');
 return true;
}
