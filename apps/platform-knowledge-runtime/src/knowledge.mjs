import {assertQuery} from '@profitia/platform-knowledge-contracts';
import {eligibleSource} from '@profitia/platform-knowledge-core/policy';
import {fitContextAsync} from '@profitia/platform-knowledge-core/context';
import {queryIdentifiers,fuseCandidates} from '@profitia/platform-knowledge-core/ranking';
import {transaction,sourceFromRow,Fault,digest} from './store.mjs';
import {CONTEXT_TOKENIZER} from './provider.mjs';

export async function queryKnowledge({pool,provider,query,scope}){
 assertQuery(query);const principal=scope.principal;
 if(query.targetModel!=='gpt-6-luna'||query.tokenizerId!==CONTEXT_TOKENIZER)throw new Fault(422,'TARGET_TOKENIZER_UNSUPPORTED');
 if(query.task!=='ANSWER')throw new Fault(422,'TASK_REQUIRES_DOCUMENT_REPRESENTATION');
 // RLS and the same explicit source restrictions run BEFORE vector/lexical/
 // exact candidate formation or any model call. No global top-k then filter.
 const sources=await transaction(pool,async db=>(await db.query(`SELECT s.*,g.coverage FROM platform_knowledge.sources s
  JOIN platform_knowledge.generations g ON g.id=s.active_generation_id AND g.state='ACTIVE'
  WHERE s.scope=ANY($1::text[]) AND($2::uuid[] IS NULL OR s.id=ANY($2::uuid[]))`,[query.scopes,query.documentIds??null])).rows,principal);
 const allowed=sources.filter(s=>eligibleSource(sourceFromRow(s),principal,'apiExcerpt')&&eligibleSource(sourceFromRow(s),principal,'quote')
  &&s.rights.externalAiAllowed===true);
 let evidence=[];const omissions=[];
 if(allowed.length){
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
   evidence.push({evidenceId:row.id,sourceId:source.id,documentId:source.id,generationId:row.generation_id,sourceVersion:String(source.source_version),
    text:row.text_content,scope:source.scope,locations:row.locations,rights:source.rights,coverage:source.coverage.failedUnitIds.length?'PARTIAL':'COMPLETE',
    authority:source.authority,rank:row.rank,validUntil:source.expires_at?.toISOString()??null});
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
  const current=(await db.query('SELECT * FROM platform_knowledge.sources WHERE id=ANY($1::uuid[])',[evidence.map(e=>e.sourceId)])).rows;
  return evidence.filter(e=>{const source=current.find(s=>s.id===e.sourceId);return source&&source.active_generation_id===e.generationId
   &&eligibleSource(sourceFromRow(source),principal,'apiExcerpt')&&eligibleSource(sourceFromRow(source),principal,'quote');});
 },principal);
 if(evidence.some(e=>e.coverage==='PARTIAL'))omissions.push('SOURCE_PARTIAL');
 return fitContextAsync(query,evidence,{countTokens:text=>provider.countContext(text,scope),omissions,version:query.version});
}
