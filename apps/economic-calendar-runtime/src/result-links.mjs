/** Exact edition identity is separate from numerical data and semantic history.
 * Reconciliation uses only retained ECR facts and never calls a provider.
 */
import {resultScope} from './result-scope.mjs'
export async function recordResultLink(t,id,sequence,event,method='EXACT_EIA_WPSR_REFERENCE_PERIOD/1'){
 await t.query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-result-link:'||$1,0))",[id])
 const {rows:[old]}=await t.query('SELECT * FROM economic_calendar.result_links WHERE observation_id=$1 ORDER BY version DESC LIMIT 1',[id])
 // A genuinely observed result version needs its own licensed source binding.
 // Replaying the same version remains idempotent; no source facts are rewritten.
 if(old&&old.event_id===event&&Number(old.source_sequence)===sequence&&old.method===method)return false
 await t.query('INSERT INTO economic_calendar.result_links(observation_id,version,source_sequence,event_id,method,status) VALUES($1,$2,$3,$4,$6,$5)',[id,Number(old?.version??0)+1,sequence,event,event?'MATCHED_REFERENCE_PERIOD':'UNRESOLVED_EDITION',method])
 return true
}
export async function reconcileResultLinks(t){
 let after='',changed=0
 for(;;){
  const {rows}=await t.query(`SELECT DISTINCT ON(o.observation_id) o.observation_id,o.sequence,o.reference_period,o.dataset_id FROM economic_calendar.result_observations o
   WHERE provider_id='eia' AND adopted_as_current AND o.observation_id>$1
   AND (SELECT l.event_id FROM economic_calendar.result_links l WHERE l.observation_id=o.observation_id ORDER BY version DESC LIMIT 1) IS NULL
   ORDER BY o.observation_id,sequence DESC LIMIT 500`,[after])
  for(const o of rows){
   const scope=resultScope(o.dataset_id)
   const {rows:matches}=await t.query("SELECT event_id FROM economic_calendar.events WHERE provider='eia' AND current_data->'source'->>'publicationRef'=$2 AND current_data->'reference'->>'providerValue'=$1",[o.reference_period,scope.publicationRef])
   if(matches.length===1&&await recordResultLink(t,o.observation_id,o.sequence,matches[0].event_id,scope.method))changed++
  }
  if(rows.length<500)break;after=rows.at(-1).observation_id
 }
 return changed
}
