import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import {schemas} from '@profitia/platform-knowledge-contracts';
import {transaction,Fault,digest,audit} from './store.mjs';
import {EXTENSIONS} from './extraction.mjs';
import {generationProfile} from './processing.mjs';
import {revokeSource} from './retention.mjs';
const ajv=new Ajv({strict:true,allErrors:false});addFormats(ajv);ajv.addSchema(schemas);
const validateImport=ajv.compile({$ref:schemas.$id+'#/$defs/Import'});
export const validateSchema=(name,value)=>ajv.validate({$ref:schemas.$id+'#/$defs/'+name},value);
const MEDIA={'.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 '.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.txt':'text/plain','.md':'text/markdown','.markdown':'text/markdown'};
export function validateUpload(input,bytes,principal){
 if(!validateImport(input)||!Buffer.isBuffer(bytes)||bytes.length!==input.sizeBytes||digest(bytes)!==input.sha256)throw new Fault(422,'INVALID_IMPORT');
 const extension=path.extname(input.fileName).toLowerCase();
 if(!EXTENSIONS.has(extension)||MEDIA[extension]!==input.mediaType||/[\x00-\x1f/\\]/.test(input.fileName))throw new Fault(415,'FORMAT_MISMATCH');
 const r=input.rights;
 if(!r.externalAiAllowed)throw new Fault(403,'EXTERNAL_AI_NOT_ALLOWED');
 if(input.scope==='ACCOUNT_PRIVATE'&&!principal.internalUserId)throw new Fault(403,'ACCOUNT_REQUIRED');
 if(input.scope==='PROFITIA_SHARED'&&(!principal.operator||r.classification==='UNKNOWN'||r.purpose==='PRIVATE'))throw new Fault(403,'SHARED_IMPORT_NOT_ALLOWED');
 if(r.organisationConstraintId!==null&&!principal.organisationIds?.includes(r.organisationConstraintId))throw new Fault(403,'SOURCE_ORGANISATION_RESTRICTION');
 if(r.purpose==='PROFITIA_INTERNAL'&&principal.usePurpose!=='PROFITIA_INTERNAL')throw new Fault(403,'SOURCE_PURPOSE_RESTRICTION');
 // UNKNOWN remains UNKNOWN. Neither the current organisation nor an AI guess
 // becomes an organisation constraint or an expansion of usage rights.
 return input;
}

// Small internal operator surface. Spacing/radii follow the verified SpendGuru
// canon (MagicPath 460628347660177408, tokens v1.0); no parallel user portal.
export function adminPage(config){
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clerk=config.clerkFrontendOrigin&&config.clerkPublishableKey?`<script defer crossorigin="anonymous" src="${safe(config.clerkFrontendOrigin)}/npm/@clerk/ui@1.41.1/dist/ui.browser.js"></script><script defer crossorigin="anonymous" data-clerk-publishable-key="${safe(config.clerkPublishableKey)}" src="${safe(config.clerkFrontendOrigin)}/npm/@clerk/clerk-js@6.40.0/dist/clerk.browser.js"></script>`:'';
 return `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Platform Knowledge · Profitia</title>
 <style>:root{font-family:Inter,system-ui,sans-serif;color:#202833;background:#f5f7fa;font-size:14px}*{box-sizing:border-box}body{margin:0}header{background:white;border-bottom:1px solid #e1e5eb;padding:20px 32px;display:flex;justify-content:space-between;align-items:center}h1{font-size:22px;margin:0}h2{font-size:17px;margin:0 0 16px}p{line-height:1.5;color:#566273}main{max-width:1160px;margin:28px auto;padding:0 24px}.card{border:1px solid #e1e5eb;border-radius:9px;background:white;padding:24px;margin-bottom:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}label{display:block;font-size:12px;color:#566273;margin:0 0 6px}input,select,textarea{width:100%;border:1px solid #cdd4de;border-radius:6px;padding:10px;font:inherit;background:white;color:inherit}input[type=checkbox]{width:auto}button{height:32px;padding:0 14px;border:1px solid #168e83;border-radius:7px;background:#168e83;color:white;font:500 12px Inter,system-ui;cursor:pointer}button.secondary{background:white;color:#283648;border-color:#cdd4de}button.danger{background:white;color:#b53838;border-color:#e2baba}button:disabled{opacity:.45;cursor:wait}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #84c8f2;outline-offset:2px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.muted{color:#687587;font-size:12px}.badge{font-size:11px;background:#edf5f3;color:#27685e;padding:5px 9px;border-radius:6px}.row{padding:16px 0;border-top:1px solid #e5e9ef}.row:first-child{border-top:0}.title{font-weight:600;margin-bottom:5px}#status{white-space:pre-wrap;padding:14px 0;min-height:30px}details{margin-top:10px}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto;background:#f4f6f8;padding:12px;border-radius:6px;font-size:12px}.hidden{display:none!important}@media(max-width:700px){.grid{grid-template-columns:1fr}header{padding:18px 24px}.card{padding:18px}main{padding:0 16px}}</style>
 <header><div><h1>Platform Knowledge</h1><p class="muted">Wewnętrzna biblioteka wiedzy Profitii</p></div><div><span class="badge">Development</span> <span id="account"></span></div></header>
 <main><div id="login" class="card"><h2>Dostęp administratora</h2><p>Zaloguj się kontem Profitii. Biblioteka sprawdzi uprawnienia do tej funkcji.</p><div id="signin"></div></div>
 <div id="workspace" class="hidden"><section class="card"><h2>Dodaj materiał do wspólnej biblioteki</h2><p>Dokument zostanie przetworzony automatycznie. Po zakończeniu przejrzysz wynik i opublikujesz cały materiał.</p>
 <form id="upload"><div class="grid"><div><label for="file">Dokument</label><input id="file" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.markdown"><p class="muted">PDF, Word, PowerPoint, TXT, Markdown · do 50 MB</p></div><div><label for="title">Tytuł materiału</label><input id="title" required maxlength="500"></div>
 <div><label for="classification">Klasyfikacja źródła</label><select id="classification"><option value="INTERNAL">Wewnętrzny</option><option value="PUBLIC">Publiczny</option><option value="CONFIDENTIAL">Poufny</option><option value="RESTRICTED">Zastrzeżony</option></select></div>
 <div><label for="purpose">Dopuszczone wykorzystanie</label><select id="purpose"><option value="PROFITIA_INTERNAL">Wewnętrznie w Profitii</option><option value="CUSTOMER_SERVICE">Również w usługach dla klientów</option></select></div>
 <div><label for="author">Autor / instytucja</label><input id="author" maxlength="300"></div><div><label for="published">Data publikacji</label><input id="published" type="date"></div>
 <div><label for="domain">Dziedzina</label><input id="domain" value="procurement" maxlength="200"></div><div><label for="kind">Rodzaj materiału</label><select id="kind"><option value="OTHER">Inny</option><option value="STANDARD">Standard</option><option value="BOOK">Książka</option><option value="REPORT">Raport</option><option value="PRESENTATION">Prezentacja</option><option value="NOTE">Opracowanie</option></select></div>
 <div><label for="organisation">Ograniczenie do organizacji źródła (opcjonalne)</label><input id="organisation" placeholder="Identyfikator organizacji"><p class="muted">Puste pole nie przypisuje materiału do organizacji.</p></div><div><label for="validUntil">Koniec praw do wykorzystania (opcjonalnie)</label><input id="validUntil" type="date"></div></div>
 <p><label><input type="checkbox" id="external" required> Mam prawo przekazać treść do przetwarzania przez OpenAI API.</label><label><input type="checkbox" id="quoting"> Dopuszczone cytowanie fragmentów.</label><label><input type="checkbox" id="api"> Dopuszczone przekazywanie fragmentów przez API i do kontekstu.</label></p>
 <button id="submit">Przetwórz dokument</button></form><div id="status" role="status" aria-live="polite"></div></section>
 <section class="card"><h2>Materiały</h2><button class="secondary" id="refresh">Odśwież</button><div id="sources"></div></section>
 <section class="card"><h2>Sprawdź wiedzę</h2><p>Zadaj naturalne pytanie. Wyszukiwanie obejmie opublikowane materiały.</p><form id="search"><label for="query">Pytanie</label><textarea id="query" required rows="3" maxlength="12000"></textarea><div class="actions"><button>Wyszukaj dowody</button></div></form><div id="results" aria-live="polite"></div></section></div></main>${clerk}<script defer src="/admin.js"></script></html>`;
}
export const adminScript=String.raw`
'use strict';
const el=id=>document.getElementById(id),status=text=>{el('status').textContent=text;};
const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
async function api(path,options={}){const token=await window.Clerk.session.getToken();if(!token)throw Error('Zaloguj się ponownie.');
 const response=await fetch(path,{...options,credentials:'omit',headers:{authorization:'Bearer '+token,...options.headers}});
 const data=await response.json();if(!response.ok)throw Error(data.error??'Nie udało się wykonać operacji.');return data;}
const labels={QUEUED:'W kolejce',RUNNING:'Przetwarzanie',RETRY_WAIT:'Ponawianie zadania',READY:'Gotowy',PARTIAL:'Wynik częściowy',FAILED:'Błąd przetwarzania',REVOKED:'Wycofany'};
async function refresh(){try{const sources=await api('/v1/sources');const list=el('sources');list.replaceChildren();for(const source of sources){
 const row=node('article','');row.className='row';const title=node('div',source.metadata?.title??source.file_name);title.className='title';row.append(title);
 row.append(node('div',(labels[source.processing_status]??source.processing_status??'')+(source.published_at?' · Opublikowany':' · Nieopublikowany')));
 if(source.coverage)row.append(node('p','Rozliczone jednostki: '+source.coverage.accountedUnits+'/'+source.coverage.expectedUnits+' · Odczytane w całości: '+source.coverage.completeUnits));
 const actions=node('div','');actions.className='actions';
 const details=node('button','Zobacz wynik');details.className='secondary';details.onclick=async()=>{try{const data=await api('/v1/sources/'+source.id);let pre=row.querySelector('pre');if(!pre){pre=node('pre','');row.append(pre);}pre.textContent=(data.cognitive_result??[]).map(part=>part.summary).filter(Boolean).join('\n\n')||'Wynik nie jest jeszcze dostępny.';if(data.coverage?.failedUnitIds?.length)pre.textContent+='\n\nNiepełny odczyt: '+data.coverage.failedUnitIds.join(', ');}catch(e){status(e.message);}};actions.append(details);
 if(source.status!=='WITHDRAWN'&&['READY','PARTIAL'].includes(source.processing_status)&&!source.published_at){const publish=node('button','Opublikuj materiał');publish.onclick=async()=>{if(!confirm(source.processing_status==='PARTIAL'?'Materiał zawiera oznaczone braki. Czy akceptujesz publikację całego częściowego wyniku?':'Czy publikujesz ten materiał zgodnie z wybranymi prawami wykorzystania?'))return;
  try{await api('/v1/sources/'+source.id+'/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({acknowledgePartial:source.processing_status==='PARTIAL',authority:'REFERENCE'})});status('Materiał opublikowany.');await refresh();}catch(e){status(e.message);}};actions.append(publish);}
 const withdraw=node('button','Wycofaj');withdraw.className='secondary';withdraw.onclick=async()=>{try{await api('/v1/sources/'+source.id+'/withdraw',{method:'POST'});status('Materiał odcięty od wyszukiwania.');await refresh();}catch(e){status(e.message);}};actions.append(withdraw);
 const remove=node('button','Usuń');remove.className='danger';remove.onclick=async()=>{if(!confirm('Usunąć materiał i jego wiedzę pochodną?'))return;try{await api('/v1/sources/'+source.id,{method:'DELETE'});status('Dostęp odcięty. Trwa kontrolowane usuwanie danych.');await refresh();}catch(e){status(e.message);}};actions.append(remove);
 row.append(actions);list.append(row);}if(!sources.length)list.append(node('p','Biblioteka nie zawiera jeszcze materiałów.'));}catch(e){status(e.message);}}
el('file').onchange=()=>{if(!el('title').value)el('title').value=el('file').files[0]?.name??'';};
el('upload').onsubmit=async event=>{event.preventDefault();el('submit').disabled=true;try{const file=el('file').files[0];if(!file||file.size>52428800)throw Error('Wybierz plik o wielkości do 50 MB.');
 status('Przesyłanie dokumentu…');const bytes=await file.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const extension=file.name.split('.').pop().toLowerCase(),types={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',md:'text/markdown',markdown:'text/markdown'};
 const metadata={version:'0.2.0',requestId:crypto.randomUUID(),scope:'PROFITIA_SHARED',fileName:file.name,mediaType:types[extension],sizeBytes:file.size,sha256:hash,memoryRequested:false,
 rights:{classification:el('classification').value,purpose:el('purpose').value,organisationConstraintId:el('organisation').value.trim()||null,externalAiAllowed:el('external').checked,quotingAllowed:el('quoting').checked,apiExcerptAllowed:el('api').checked},
 metadata:{domain:el('domain').value,materialType:el('kind').value,title:el('title').value,author:el('author').value||null,language:'pl',publishedAt:el('published').value||null,validFrom:null,validUntil:el('validUntil').value?new Date(el('validUntil').value+'T23:59:59Z').toISOString():null}};
 const header=btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(metadata)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
 await api('/v1/imports',{method:'POST',headers:{'content-type':'application/octet-stream','x-pk-import':header},body:file});status('Dokument przyjęty. Obróbka trwa automatycznie; nie wymaga akceptowania kolejnych fragmentów.');await refresh();
 }catch(e){status(e.message);}finally{el('submit').disabled=false;}};
el('refresh').onclick=refresh;el('search').onsubmit=async event=>{event.preventDefault();const result=el('results');result.replaceChildren(node('p','Wyszukiwanie…'));try{const data=await api('/v1/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({version:'0.2.0',requestId:crypto.randomUUID(),task:'ANSWER',query:el('query').value,language:'pl',scopes:['PROFITIA_SHARED'],maxTokens:6000,tokenizerId:'openai:responses/input_tokens:gpt-6-luna:v1',targetModel:'gpt-6-luna'})});
 result.replaceChildren(node('p',data.status==='INSUFFICIENT_EVIDENCE'?'Brak wystarczających dowodów w dostępnej wiedzy.':data.status==='PARTIAL'?'Kontekst częściowy — sprawdź oznaczone braki.':'Odnaleziono dowody.'));
 for(const evidence of data.evidence){const detail=node('details','');detail.append(node('summary',evidence.authority+' · '+evidence.locations.map(l=>l.kind+' '+l.ordinal).join(', ')));detail.append(node('pre',evidence.text));result.append(detail);}
 }catch(e){result.replaceChildren(node('p',e.message));}};
(async()=>{for(let n=0;n<100&&!window.Clerk;n++)await new Promise(r=>setTimeout(r,100));if(!window.Clerk){el('signin').textContent='Logowanie nie jest jeszcze skonfigurowane dla tej biblioteki.';return;}await window.Clerk.load();if(!window.Clerk.user){window.Clerk.mountSignIn(el('signin'),{forceRedirectUrl:location.origin});return;}
el('login').classList.add('hidden');el('workspace').classList.remove('hidden');window.Clerk.mountUserButton(el('account'));await refresh();setInterval(()=>{if(!document.hidden)refresh();},15000);})();
`;
export function createLibrary({pool,storage,createDelegation}){
 return{
  async import(input,bytes,scope){
   validateUpload(input,bytes,scope.principal);
   const principal=scope.principal,{sourceId,generationId,jobId}=scope.delegation??{};
   if(![sourceId,generationId,jobId].every(v=>/^[a-f0-9-]{36}$/.test(v??'')))throw new Fault(403,'JOB_DELEGATION_REQUIRED');
   const prior=await transaction(pool,async db=>(await db.query('SELECT id,sha256 FROM platform_knowledge.sources WHERE uploaded_by=$1 AND request_id=$2',[principal.internalUserId,input.requestId])).rows[0],principal);
   if(prior){if(prior.sha256!==input.sha256)throw new Fault(409,'IMPORT_REQUEST_CONFLICT');return{sourceId:prior.id,status:'ALREADY_ACCEPTED'};}
   const delegation=await createDelegation(scope,{jobId,sourceId,generationId,scope:input.scope,ownerUserId:input.scope==='ACCOUNT_PRIVATE'?principal.internalUserId:null,
    rightsDigest:digest(input.rights),sourceVersion:1,maximumMicrousd:1000000});
   const rawKey='development/'+sourceId+'/'+input.sha256;
   // Bytes are never an unauthenticated public object or a provider file upload.
   // A durable row exists BEFORE the storage request, including an uncertain
   // request outcome. Retention can always find and remove the object key.
   const accepted=await transaction(pool,async db=>{
    await db.query('SELECT id FROM platform_knowledge.budget WHERE id=true FOR UPDATE');
    const pending=(await db.query(`SELECT count(*)::integer AS n,coalesce(sum(size_bytes),0)::bigint AS bytes FROM platform_knowledge.sources
     WHERE raw_key IS NOT NULL AND raw_deleted_at IS NULL`)).rows[0];
    if(pending.n>=20||Number(pending.bytes)+bytes.length>262144000)throw new Fault(429,'TEMPORARY_STORAGE_LIMIT');
    const now=new Date(),rawUntil=new Date(now.getTime()+86400000);
    const metadata=input.metadata??{domain:'procurement',materialType:'OTHER',title:input.fileName,author:null,language:'und',publishedAt:null,validFrom:null,validUntil:null};
    const rightsUntil=metadata.validUntil?new Date(metadata.validUntil):null;
    let until=input.scope==='ACCOUNT_PRIVATE'?new Date(now.getTime()+180*86400000):rightsUntil;
    if(rightsUntil&&(!until||until>rightsUntil))until=rightsUntil;
    if(until&&until<=now)throw new Fault(422,'SOURCE_ALREADY_EXPIRED');
    await db.query(`INSERT INTO platform_knowledge.sources(id,scope,owner_user_id,uploaded_by,request_id,file_name,media_type,size_bytes,sha256,
     rights,metadata,expires_at,rights_expires_at,raw_key,raw_expires_at,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,[
      sourceId,input.scope,input.scope==='ACCOUNT_PRIVATE'?principal.internalUserId:null,principal.internalUserId,input.requestId,input.fileName,input.mediaType,
      input.sizeBytes,input.sha256,JSON.stringify(input.rights),JSON.stringify(metadata),until,rightsUntil,rawKey,rawUntil,now]);
    await db.query(`INSERT INTO platform_knowledge.generations(id,source_id,parser_version,chunker_version,cognitive_model,embedding_model,embedding_dimensions,config_digest)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[generationId,sourceId,...Object.values(generationProfile),digest(generationProfile)]);
    await db.query(`INSERT INTO platform_knowledge.jobs(id,source_id,generation_id,kind,delegation,available_at,stage) VALUES($1,$2,$3,'IMPORT',$4,clock_timestamp()+interval '3 minutes','UPLOAD_PENDING')`,[jobId,sourceId,generationId,JSON.stringify(delegation)]);
    await audit(db,{sourceId,jobId,operation:'IMPORT',actorRef:principal.internalUserId,outcome:'ACCEPTED'});
    return{sourceId,jobId,generationId,status:'QUEUED'};
   },principal);
   try{
    await storage.put(rawKey,bytes,input.sha256);
    await transaction(pool,db=>db.query("UPDATE platform_knowledge.jobs SET stage='EXTRACT',available_at=clock_timestamp() WHERE id=$1 AND status='QUEUED'",[jobId]),principal);
    return accepted;
   }catch(error){
    await transaction(pool,db=>db.query("UPDATE platform_knowledge.jobs SET status='FAILED',error_code='RAW_UPLOAD_UNCONFIRMED',finished_at=clock_timestamp() WHERE id=$1 AND status='QUEUED'",[jobId]),principal).catch(()=>{});
    // The durable cleanup key remains even if removal cannot be confirmed.
    await storage.remove(rawKey).then(()=>transaction(pool,db=>db.query('UPDATE platform_knowledge.sources SET raw_deleted_at=clock_timestamp() WHERE id=$1',[sourceId]),principal)).catch(()=>{});
    throw error;
   }
  },
  async reindexPlan(sourceId,scope){return transaction(pool,async db=>{
   const source=(await db.query(`SELECT s.*,g.parser_version FROM platform_knowledge.sources s JOIN platform_knowledge.generations g ON g.id=s.active_generation_id
    WHERE s.id=$1 AND platform_knowledge.source_visible(s)`,[sourceId])).rows[0];
   if(!source||!source.rights.externalAiAllowed)throw new Fault(409,'SOURCE_NOT_REBUILDABLE');
   if(source.parser_version!==generationProfile.parserVersion&&(!source.raw_key||source.raw_deleted_at||source.raw_expires_at<=new Date()))throw new Fault(409,'REUPLOAD_REQUIRED');
   return{scope:source.scope,rightsDigest:digest(source.rights),sourceVersion:source.source_version,parserVersion:source.parser_version};
  },scope.principal);},
  async reindex(sourceId,scope){
   const {generationId,jobId}=scope.delegation??{};
   if(!generationId||!jobId)throw new Fault(403,'JOB_DELEGATION_REQUIRED');
   const plan=await this.reindexPlan(sourceId,scope);
   const delegation=await createDelegation(scope,{sourceId,generationId,jobId,rightsDigest:plan.rightsDigest});
   return transaction(pool,async db=>{
    const source=(await db.query('SELECT * FROM platform_knowledge.sources WHERE id=$1 FOR UPDATE',[sourceId])).rows[0];
    if(!source||digest(source.rights)!==plan.rightsDigest)throw new Fault(409,'SOURCE_CHANGED');
    if((await db.query("SELECT 1 FROM platform_knowledge.jobs WHERE source_id=$1 AND status IN ('QUEUED','RUNNING','RETRY_WAIT')",[sourceId])).rowCount)throw new Fault(409,'SOURCE_JOB_ACTIVE');
    await db.query(`INSERT INTO platform_knowledge.generations(id,source_id,parser_version,chunker_version,cognitive_model,embedding_model,embedding_dimensions,config_digest)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[generationId,sourceId,...Object.values(generationProfile),digest(generationProfile)]);
    // Reuse the lossless normalized representation when the parser is unchanged.
    // The active generation remains readable until the entire shadow is valid.
    if(plan.parserVersion===generationProfile.parserVersion){
     await db.query(`UPDATE platform_knowledge.generations next SET source_digest=old.source_digest,inventory=old.inventory,coverage=old.coverage,
      character_count=old.character_count,chunk_count=old.chunk_count FROM platform_knowledge.generations old WHERE next.id=$1 AND old.id=$2`,[generationId,source.active_generation_id]);
     await db.query('SELECT platform_knowledge.copy_reindex_chunks($1::uuid,$2::uuid)',[generationId,source.active_generation_id]);
    }
    await db.query("INSERT INTO platform_knowledge.jobs(id,source_id,generation_id,kind,delegation) VALUES($1,$2,$3,'REINDEX',$4)",[jobId,sourceId,generationId,JSON.stringify(delegation)]);
    await audit(db,{sourceId,jobId,operation:'REINDEX',actorRef:scope.principal.internalUserId,outcome:'ACCEPTED'});
    return{sourceId,jobId,generationId,status:'QUEUED',activeGenerationId:source.active_generation_id};
   },scope.principal);
  },
  async statuses(input,scope){
   if(!validateSchema('SourceStatusRequest',input))throw new Fault(422,'INVALID_SOURCE_STATUS_REQUEST');
   return transaction(pool,async db=>{
    const sources=(await db.query('SELECT s.*,platform_knowledge.source_visible(s) AS content_visible FROM platform_knowledge.sources s WHERE id=ANY($1::uuid[])',[input.sourceIds])).rows;
    return{version:'0.2.0',sources:input.sourceIds.map(sourceId=>{
     const source=sources.find(s=>s.id===sourceId),checkedAt=new Date().toISOString();
     if(!source)return{sourceId,event:'UNAVAILABLE',available:false,revision:null,generationId:null,checkedAt};
     const expired=source.expires_at&&source.expires_at<=new Date(),available=!!(source.content_visible&&source.active_generation_id&&(source.scope==='ACCOUNT_PRIVATE'||source.published_at)&&source.rights.apiExcerptAllowed&&source.rights.quotingAllowed);
     return{sourceId,event:source.deleted_at?'DELETED':expired?'EXPIRED':source.revoked_at?'WITHDRAWN':available?'READY':source.active_generation_id?'PREPARED':'PROCESSING',available,
      revision:String(source.revision),generationId:available?source.active_generation_id:null,checkedAt};
    })};
   },scope.principal);
  },
  async recordUse(sourceIds,scope){
   if(!sourceIds.length)return;
   return transaction(pool,db=>db.query(`UPDATE platform_knowledge.sources s SET last_material_use_at=clock_timestamp(),
    expires_at=LEAST(coalesce(rights_expires_at,'infinity'::timestamptz),clock_timestamp()+interval '180 days')
    WHERE id=ANY($1::uuid[]) AND scope='ACCOUNT_PRIVATE' AND platform_knowledge.source_visible(s)`,[sourceIds]),scope.principal);
  },
  async list(scope){return transaction(pool,async db=>(await db.query(`SELECT s.id,s.scope,CASE WHEN platform_knowledge.source_visible(s) THEN s.file_name ELSE '[restricted or withdrawn]' END AS file_name,CASE WHEN platform_knowledge.source_visible(s) THEN s.metadata ELSE '{}'::jsonb END AS metadata,s.authority,s.status,s.published_at,s.created_at,s.expires_at,s.raw_deleted_at,
   j.id AS job_id,j.status AS processing_status,j.stage,j.error_code,g.coverage,g.validation
   FROM platform_knowledge.sources s LEFT JOIN platform_knowledge.generations g ON g.id=s.active_generation_id
   LEFT JOIN LATERAL(SELECT * FROM platform_knowledge.jobs WHERE source_id=s.id ORDER BY created_at DESC LIMIT 1) j ON true
   ORDER BY s.created_at DESC LIMIT 100`)).rows,scope.principal);},
  async get(sourceId,scope){return transaction(pool,async db=>{
   const r=(await db.query(`SELECT s.id,s.scope,CASE WHEN platform_knowledge.source_visible(s) THEN s.file_name ELSE '[restricted or withdrawn]' END AS file_name,CASE WHEN platform_knowledge.source_visible(s) THEN s.metadata ELSE '{}'::jsonb END AS metadata,s.rights,s.authority,s.status,s.published_at,s.expires_at,s.raw_deleted_at,
    g.inventory,g.coverage,g.validation,CASE WHEN platform_knowledge.source_visible(s) AND (s.rights->>'apiExcerptAllowed')::boolean AND (s.rights->>'quotingAllowed')::boolean THEN (SELECT coalesce(jsonb_agg(c.analysis ORDER BY c.ordinal),'[]') FROM platform_knowledge.cognition c WHERE c.generation_id=g.id AND c.ordinal=-1) ELSE '[]'::jsonb END AS cognitive_result,
    j.id AS job_id,j.status AS processing_status,j.stage,j.error_code
    FROM platform_knowledge.sources s LEFT JOIN platform_knowledge.generations g ON g.id=s.active_generation_id
    LEFT JOIN LATERAL(SELECT * FROM platform_knowledge.jobs WHERE source_id=s.id ORDER BY created_at DESC LIMIT 1)j ON true WHERE s.id=$1`,[sourceId])).rows[0];
   if(!r)throw new Fault(404,'SOURCE_NOT_FOUND');return r;
  },scope.principal);},
  async publish(sourceId,{acknowledgePartial=false,authority='REFERENCE'}={},scope){
   if(!scope.principal.operator)throw new Fault(403,'OPERATOR_REQUIRED');
   if(!['REFERENCE','HISTORICAL','BINDING_STANDARD'].includes(authority)||authority==='BINDING_STANDARD'&&!scope.principal.publishBindingStandard)throw new Fault(403,'SOURCE_AUTHORITY_NOT_ALLOWED');
   return transaction(pool,async db=>{
    const source=(await db.query(`SELECT s.*,g.validation FROM platform_knowledge.sources s JOIN platform_knowledge.generations g ON g.id=s.active_generation_id
     WHERE s.id=$1 AND s.scope='PROFITIA_SHARED' AND g.state='ACTIVE' FOR UPDATE OF s`,[sourceId])).rows[0];
    if(!source||source.deleted_at||source.revoked_at||source.expires_at&&source.expires_at<=new Date()||source.rights.classification==='UNKNOWN'||source.rights.purpose==='PRIVATE')throw new Fault(409,'SOURCE_NOT_PUBLISHABLE');
    if(source.validation.quality==='PARTIAL'&&!acknowledgePartial)throw new Fault(409,'WHOLE_PARTIAL_RESULT_ACKNOWLEDGEMENT_REQUIRED');
    await db.query('UPDATE platform_knowledge.sources SET published_at=clock_timestamp(),published_by=$2,authority=$3,status=$4,revision=revision+1 WHERE id=$1',[
     sourceId,scope.principal.internalUserId,authority,authority==='HISTORICAL'?'HISTORICAL':'CURRENT']);
    await audit(db,{sourceId,operation:'SOURCE_PUBLISHED',actorRef:scope.principal.internalUserId,outcome:'COMPLETED'});return{sourceId,status:'PUBLISHED'};
   },scope.principal,scope.transaction??null);
  },
  async revoke(sourceId,deleted,scope){return transaction(pool,db=>revokeSource(db,{sourceId,deleted,actorRef:scope.principal.internalUserId}),scope.principal,scope.transaction??null);}
 };
}
