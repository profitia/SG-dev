import {assertQuery} from '@profitia/platform-knowledge-contracts';
import {eligibleSource} from '@profitia/platform-knowledge-core/policy';
import {fitContextAsync} from '@profitia/platform-knowledge-core/context';
import {queryIdentifiers,fuseCandidates} from '@profitia/platform-knowledge-core/ranking';
import {transaction,sourceFromRow,Fault,digest} from './store.mjs';
import {CONTEXT_TOKENIZER} from './provider.mjs';

export async function queryKnowledge({pool,provider,query,scope}){
 assertQuery(query);const principal=scope.principal;
 if(query.targetModel!=='gpt-6-luna'||query.tokenizerId!==CONTEXT_TOKENIZER)throw new Fault(422,'TARGET_TOKENIZER_UNSUPPORTED');
 if(query.task==='MEMORY_RECALL')throw new Fault(422,'MEMORY_HOST_ADOPTION_REQUIRED');
 if(query.task==='DOCUMENT_SUMMARY'&&query.version!=='0.2.0')throw new Fault(422,'SUMMARY_REQUIRES_CONTRACT_V02');
 // RLS and the same explicit source restrictions run BEFORE vector/lexical/
 // exact candidate formation or any model call. No global top-k then filter.
 const sources=await transaction(pool,async db=>(await db.query(`SELECT s.*,g.coverage,g.inventory FROM platform_knowledge.sources s
  JOIN platform_knowledge.generations g ON g.id=s.active_generation_id AND g.state='ACTIVE'
  WHERE s.scope=ANY($1::text[]) AND($2::uuid[] IS NULL OR s.id=ANY($2::uuid[]))`,[query.scopes,query.documentIds??null])).rows,principal);
 const allowed=sources.filter(s=>eligibleSource(sourceFromRow(s),principal,'apiExcerpt')&&eligibleSource(sourceFromRow(s),principal,'quote')
  &&s.rights.externalAiAllowed===true);
 let evidence=[],summary=null;const omissions=[];
 if(sources.length>allowed.length)omissions.push('RIGHTS');
 const makeEvidence=(row,source,rank)=>({evidenceId:row.id,sourceId:source.id,documentId:source.id,generationId:row.generation_id,sourceVersion:String(source.source_version),
  text:row.text_content,scope:source.scope,locations:row.locations,rights:source.rights,coverage:source.coverage.failedUnitIds.length?'PARTIAL':'COMPLETE',
  authority:source.authority,rank,validUntil:source.expires_at?.toISOString()??null});
 if(allowed.length&&query.task==='DOCUMENT_SUMMARY'){
  const source=allowed[0];
  const content=await transaction(pool,async db=>{
   const result=(await db.query('SELECT * FROM platform_knowledge.cognition WHERE generation_id=$1 AND ordinal=-1 AND complete=true',[source.active_generation_id])).rows[0];
   if(!result)throw new Fault(409,'DOCUMENT_SYNTHESIS_NOT_READY');
   const refs=[...new Set(result.analysis.statements.map(s=>s.chunkId))];
   return{analysis:result.analysis,refs,chunks:(await db.query('SELECT * FROM platform_knowledge.chunks WHERE generation_id=$1 AND id=ANY($2::uuid[]) ORDER BY ordinal',[source.active_generation_id,refs])).rows};
  },principal);
  const failed=new Set(source.coverage.failedUnitIds);
  summary={text:content.analysis.summary,generated:true,expectedUnits:source.inventory.units.length,
   coveredUnitIds:source.inventory.units.filter(u=>!failed.has(u.id)).map(u=>u.id),missingUnitIds:[...failed],evidenceIds:content.refs};
  evidence=content.chunks.map((row,index)=>makeEvidence(row,source,1/(index+1)));
  if(failed.size)omissions.push('SUMMARY_INCOMPLETE');if(!evidence.length)omissions.push('NO_SUPPORT');
 }else if(allowed.length){
  const vectors=await provider.embed({sourceId:allowed[0].id,texts:[query.query],key:'query-'+digest({requestId:query.requestId,user:principal.internalUserId??null,scopes:query.scopes}),query:true,scope});
  const rows=await transaction(pool,async db=>{
   const generations=allowed.map(s=>s.active_generation_id),identifiers=queryIdentifiers(query.query);
   const semantic=(await db.query(`SELECT id,generation_id,1-(embedding <=> $2::public.vector) AS similarity
    FROM platform_knowledge.chunks WHERE generation_id=ANY($1::uuid[]) AND embedding IS NOT NULL
    ORDER BY embedding <=> $2::public.vector,id LIMIT 40`,[generations,JSON.stringify(vectors[0])])).rows;
   const lexical=(await db.query(`SELECT id,generation_id,ts_rank_cd(search_text,websearch_to_tsquery('simple',$2)) AS lexical_score
    FROM platform_knowledge.chunks WHERE generation_id=ANY($1::uuid[]) AND search_text @@ websearch_to_tsquery('simple',$2)
    ORDER BY lexical_score DESC,id LIMIT 40`,[generations,query.query])).rows;
   const exact=identifiers.length?(await db.query(`SELECT id,generation_id FROM platform_knowledge.chunks
    WHERE generation_id=ANY($1::uuid[]) AND identifiers && $2::text[] ORDER BY id LIMIT 40`,[generations,identifiers])).rows:[];
   const fused=fuseCandidates({semantic,lexical,exact},{limit:24});
   const items=(await db.query('SELECT * FROM platform_knowledge.chunks WHERE id=ANY($1::uuid[])',[fused.map(c=>c.id)])).rows;
   return fused.map(c=>({...items.find(i=>i.id===c.id),rank:c.score}));
  },principal);
  for(const row of rows){
   const source=allowed.find(s=>s.active_generation_id===row.generation_id);if(!source||!row.text_content?.trim()||!row.locations?.length)continue;
   evidence.push(makeEvidence(row,source,row.rank));
  }
  // Semantic proximity is not proof of answering a question. An independent
  // support check returns only literal source quotes; unsupported candidates
  // never become apparently usable context. It cannot run document commands.
  if(evidence.length){
   const supported=await provider.analyze({sourceId:allowed[0].id,generationId:null,
    chunks:evidence.slice(0,12).map(e=>({id:e.evidenceId,text:e.text})),question:query.query,
    key:'support-'+digest({requestId:query.requestId,evidence:evidence.map(e=>e.evidenceId)}),scope});
   const ids=new Set(supported.statements.filter(s=>s.kind!=='INFERENCE').map(s=>s.chunkId));
   evidence=evidence.filter(e=>ids.has(e.evidenceId));
   if(!evidence.length)omissions.push('NO_SUPPORT');
  }
 }
 // Final fresh source state observation prevents an in-flight withdrawal from
 // being returned using earlier source metadata. ACG must respect validUntil.
 evidence=await transaction(pool,async db=>{
  const current=(await db.query('SELECT * FROM platform_knowledge.sources WHERE id=ANY($1::uuid[])',[[...new Set([...evidence.map(e=>e.sourceId),...(summary?allowed.map(s=>s.id):[])])]])).rows;
  if(summary&&!current.some(s=>s.id===allowed[0].id&&s.active_generation_id===allowed[0].active_generation_id
   &&eligibleSource(sourceFromRow(s),principal,'apiExcerpt')&&eligibleSource(sourceFromRow(s),principal,'quote')))summary=null;
  return evidence.filter(e=>{const source=current.find(s=>s.id===e.sourceId);return source&&source.active_generation_id===e.generationId
   &&eligibleSource(sourceFromRow(source),principal,'apiExcerpt')&&eligibleSource(sourceFromRow(source),principal,'quote');});
 },principal);
 if(evidence.some(e=>e.coverage==='PARTIAL'))omissions.push('SOURCE_PARTIAL');
 return fitContextAsync(query,evidence,{countTokens:text=>provider.countContext(text,scope),omissions,version:query.version,summary});
}
