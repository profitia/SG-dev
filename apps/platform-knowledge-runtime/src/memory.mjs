import {eligibleSource} from '@profitia/platform-knowledge-core/policy';
// Independent preparation only. Consent/persistence and live history delivery
// remain owned by the explicit Stage3 host/lifecycle adoption, not this helper.
export function usableMemory(memory,{principal,accountState,sources,now=Date.now()}){
 if(!memory||!principal||memory.scope!=='ACCOUNT_PRIVATE'||memory.ownerUserId!==principal.internalUserId||memory.ownerOrganisationId!==null
  ||accountState?.user_id!==principal.internalUserId||accountState.deleted_at||accountState.memory_enabled!==true||!accountState.consent_at
  ||accountState.consent_version!=='pk-memory-opt-in-v1'||!Number.isFinite(Date.parse(accountState.consent_at))||Date.parse(accountState.consent_at)>now
  ||!Number.isFinite(Date.parse(memory.expiresAt))||Date.parse(memory.expiresAt)<=now
  ||typeof memory.text!=='string'||memory.text.length>2000||!Array.isArray(memory.sourceRefs))return false;
 if(!memory.sourceRefs.length)return memory.origin==='USER_EXPLICIT';
 return memory.sourceRefs.every(ref=>{const source=sources.find(s=>s.id===ref.sourceId);return source&&source.scope==='ACCOUNT_PRIVATE'&&ref.generationId===source.activeGenerationId&&ref.sourceVersion===String(source.sourceVersion)
  &&eligibleSource(source,principal,'context',now)&&eligibleSource(source,principal,'quote',now)&&eligibleSource(source,principal,'apiExcerpt',now);});
}
