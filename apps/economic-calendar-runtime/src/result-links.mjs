/** Exact edition identity is separate from numerical data and semantic history.
 * Reconciliation uses only retained ECR facts and never calls a provider.
 */
export async function recordResultLink(t,id,sequence,event){
 await t.query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-result-link:'||$1,0))",[id])
 const {rows:[old]}=await t.query('SELECT * FROM economic_calendar.result_links WHERE observation_id=$1 ORDER BY version DESC LIMIT 1',[id])
 if(old&&old.event_id===event)return false
 await t.query("INSERT INTO economic_calendar.result_links(observation_id,version,source_sequence,event_id,method,status) VALUES($1,$2,$3,$4,'EXACT_EIA_WPSR_REFERENCE_PERIOD/1',$5)",[id,Number(old?.version??0)+1,sequence,event,event?'MATCHED_REFERENCE_PERIOD':'UNRESOLVED_EDITION'])
 return true
}
export async function reconcileResultLinks(t){
 let after='',changed=0
 for(;;){
  const {rows}=await t.query(`SELECT DISTINCT ON(o.observation_id) o.observation_id,o.sequence,o.reference_period FROM economic_calendar.result_observations o
   WHERE provider_id='eia' AND adopted_as_current AND o.observation_id>$1
   AND (SELECT l.event_id FROM economic_calendar.result_links l WHERE l.observation_id=o.observation_id ORDER BY version DESC LIMIT 1) IS NULL
   ORDER BY o.observation_id,sequence DESC LIMIT 500`,[after])
  for(const o of rows){
   const {rows:matches}=await t.query("SELECT event_id FROM economic_calendar.events WHERE provider='eia' AND current_data->'source'->>'publicationRef'='eia:wpsr' AND current_data->'reference'->>'providerValue'=$1",[o.reference_period])
   if(matches.length===1&&await recordResultLink(t,o.observation_id,o.sequence,matches[0].event_id))changed++
  }
  if(rows.length<500)break;after=rows.at(-1).observation_id
 }
 return changed
}
