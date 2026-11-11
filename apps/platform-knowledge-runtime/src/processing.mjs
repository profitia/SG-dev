import {randomUUID} from 'node:crypto';
import {chunkDocument,reconstructSource,CHUNKING_VERSION} from '@profitia/platform-knowledge-core/chunking';
import {queryIdentifiers} from '@profitia/platform-knowledge-core/ranking';
import {extractDocument,PARSER_VERSION} from './extraction.mjs';
import {embeddingTokens} from './provider.mjs';
import {withJob,checkpoint} from './jobs.mjs';
import {Fault,audit} from './store.mjs';

export async function processJob({pool,storage,provider,authorizeJob,job,signal}){
 // Resume/recovery obtains a fresh bounded service delegation from the existing
 // authority. A serialized user id in a queue is never treated as permission.
 const scope=await authorizeJob(job);
 let source=await withJob(pool,job,async db=>(await db.query('SELECT * FROM platform_knowledge.sources WHERE id=$1',[job.source_id])).rows[0]);
 if(!source.rights.externalAiAllowed)throw new Fault(403,'RIGHTS_DENIED');
 let chunks=await withJob(pool,job,async db=>(await db.query('SELECT * FROM platform_knowledge.chunks WHERE generation_id=$1 ORDER BY ordinal',[job.generation_id])).rows);
 if(!chunks.length){
  if(!source.raw_key||source.raw_deleted_at||source.raw_expires_at<=new Date())throw new Fault(409,'REUPLOAD_REQUIRED');
  const bytes=await storage.get(source.raw_key,source.sha256);
  const extracted=await extractDocument(bytes,source.file_name,{signal});bytes.fill(0);
  const parsed=chunkDocument(extracted.units,{countTokens:embeddingTokens,maxTokens:768});
  if(!parsed.chunks.some(c=>c.text.trim()&&c.locations.length))throw new Fault(422,'NO_EXTRACTABLE_TEXT');
  const rows=parsed.chunks.map((c,ordinal)=>({...c,id:randomUUID(),ordinal}));
  await withJob(pool,job,async db=>{
   for(const c of rows)await db.query(`INSERT INTO platform_knowledge.chunks(id,generation_id,ordinal,start_offset,end_offset,text_content,sha256,token_count,locations,identifiers)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[c.id,job.generation_id,c.ordinal,c.start,c.end,c.text,c.sha256,c.tokenCount,JSON.stringify(c.locations),queryIdentifiers(c.text)]);
   await db.query(`UPDATE platform_knowledge.generations SET source_digest=$2,inventory=$3,coverage=$4,character_count=$5,chunk_count=$6 WHERE id=$1`,[
    job.generation_id,parsed.sourceDigest,JSON.stringify({...extracted.inventory,units:parsed.units,normalization:parsed.normalization,offsetUnit:parsed.offsetUnit}),
    JSON.stringify(parsed.coverage),parsed.characterCount,rows.length]);
   await db.query("UPDATE platform_knowledge.jobs SET stage='COGNITIVE',checkpoint=checkpoint||'{\"extractionComplete\":true}'::jsonb WHERE id=$1",[job.id]);
  });
  chunks=rows.map(c=>({...c,text_content:c.text,start_offset:c.start,end_offset:c.end,locations:c.locations,embedding:null}));
 }
 const usable=chunks.filter(c=>c.text_content.trim()&&c.locations.length);
 for(let index=0;index<usable.length;index+=4){
  signal?.throwIfAborted();
  const ordinal=index/4;
  const existing=await withJob(pool,job,async db=>(await db.query('SELECT 1 FROM platform_knowledge.cognition WHERE generation_id=$1 AND ordinal=$2 AND complete=true',[job.generation_id,ordinal])).rowCount);
  if(existing)continue;
  const batch=usable.slice(index,index+4).map(c=>({id:c.id,text:c.text_content}));
  const analysis=await provider.analyze({sourceId:source.id,generationId:job.generation_id,chunks:batch,key:'cognitive-'+ordinal,scope,signal});
  await withJob(pool,job,db=>db.query(`INSERT INTO platform_knowledge.cognition(generation_id,ordinal,chunk_ids,analysis,complete)
   VALUES($1,$2,$3,$4,true) ON CONFLICT(generation_id,ordinal) DO NOTHING`,[job.generation_id,ordinal,batch.map(c=>c.id),JSON.stringify(analysis)]));
 }
 await checkpoint(pool,job,'EMBEDDING',{cognitiveComplete:true});
 for(let index=0;index<usable.length;index+=16){
  signal?.throwIfAborted();
  const batch=usable.slice(index,index+16);
  const present=await withJob(pool,job,async db=>(await db.query('SELECT count(*)::integer AS n FROM platform_knowledge.chunks WHERE id=ANY($1::uuid[]) AND embedding IS NOT NULL',[batch.map(c=>c.id)])).rows[0].n);
  if(present===batch.length)continue;
  const vectors=await provider.embed({sourceId:source.id,generationId:job.generation_id,texts:batch.map(c=>c.text_content),key:'embedding-'+index,scope,signal});
  await withJob(pool,job,async db=>{for(let i=0;i<batch.length;i++)await db.query('UPDATE platform_knowledge.chunks SET embedding=$2::public.vector WHERE id=$1',[batch[i].id,JSON.stringify(vectors[i])]);});
 }
 await checkpoint(pool,job,'VERIFY',{embeddingComplete:true});
 // Full round-trip, independent source inventory, complete cognition/embedding
 // coverage and searchable lexical rows are required before any cutover.
 await withJob(pool,job,async db=>{
  const generation=(await db.query('SELECT * FROM platform_knowledge.generations WHERE id=$1 FOR UPDATE',[job.generation_id])).rows[0];
  const stored=(await db.query('SELECT * FROM platform_knowledge.chunks WHERE generation_id=$1 ORDER BY ordinal',[job.generation_id])).rows;
  reconstructSource(stored.map(c=>({start:c.start_offset,end:c.end_offset,text:c.text_content,sha256:c.sha256})),generation.source_digest);
  const evidenceRows=stored.filter(c=>c.text_content.trim()&&c.locations.length);
  const cognitive=(await db.query('SELECT * FROM platform_knowledge.cognition WHERE generation_id=$1 AND complete=true',[job.generation_id])).rows;
  const covered=new Set(cognitive.flatMap(c=>c.chunk_ids));
  if(generation.coverage.expectedUnits!==generation.coverage.accountedUnits||generation.coverage.chunkedCharacters!==generation.coverage.extractedCharacters
    ||evidenceRows.some(c=>!c.embedding||!covered.has(c.id))||!evidenceRows.length)throw new Fault(422,'GENERATION_VALIDATION_FAILED');
  const searchable=(await db.query("SELECT count(*)::integer AS n FROM platform_knowledge.chunks WHERE generation_id=$1 AND embedding IS NOT NULL AND length(search_text)>0",[job.generation_id])).rows[0].n;
  if(!searchable)throw new Fault(422,'GENERATION_NOT_SEARCHABLE');
  const partial=generation.coverage.failedUnitIds.length>0;
  await db.query("UPDATE platform_knowledge.generations SET state='VERIFIED',verified_at=clock_timestamp(),validation=$2 WHERE id=$1",[job.generation_id,JSON.stringify({roundTrip:true,inventory:true,indexed:true,cognitiveCoverage:true,embeddingCoverage:true,quality:partial?'PARTIAL':'COMPLETE'})]);
  await db.query("UPDATE platform_knowledge.generations SET state='RETIRED' WHERE id=(SELECT active_generation_id FROM platform_knowledge.sources WHERE id=$1)",[source.id]);
  await db.query("UPDATE platform_knowledge.generations SET state='ACTIVE' WHERE id=$1",[job.generation_id]);
  await db.query('UPDATE platform_knowledge.sources SET active_generation_id=$2,revision=revision+1 WHERE id=$1',[source.id,job.generation_id]);
  await db.query("UPDATE platform_knowledge.jobs SET status=$2,stage='COMPLETE',finished_at=clock_timestamp(),lease_until=NULL WHERE id=$1",[job.id,partial?'PARTIAL':'READY']);
  await audit(db,{sourceId:source.id,jobId:job.id,operation:'GENERATION_ACTIVATED',actorRef:'worker',outcome:'COMPLETED',technical:{partial,chunks:stored.length}});
 });
 // Cleanup is independently retried by retention if storage is temporarily down.
 if(source.raw_key){await storage.remove(source.raw_key);await pool.query('UPDATE platform_knowledge.sources SET raw_deleted_at=clock_timestamp() WHERE id=$1 AND raw_deleted_at IS NULL',[source.id]);}
}
export const generationProfile={parserVersion:PARSER_VERSION,chunkerVersion:CHUNKING_VERSION,cognitiveModel:'gpt-6-luna',embeddingModel:'text-embedding-3-small',embeddingDimensions:1536};
