import {pathToFileURL} from 'node:url'
import {fingerprint} from '@profitia/economic-calendar-contracts'
import {loadConfiguration} from '../src/config.mjs'
import {createDatabase} from '../src/database.mjs'

/** Real Development readback only. No source request, write, test identity or
 * fixture. The genuine bearer is supplied privately by the existing session.
 * Output contains counts/digests/receipts, never tokens or retained payloads.
 */
export async function verifyStorage(env=process.env){
 const config=loadConfiguration(env,'ingest'),origin=config.publicOrigin,org=env.ECR_SYNC_ORGANISATION_ID,token=env.ECR_PROBE_TOKEN
 if(typeof token!=='string'||!token.length||!/^[a-f0-9-]{36}$/i.test(org??''))throw Error('GENUINE_CURRENT_READ_CONTEXT_REQUIRED')
 const independent=async()=>{
  const db=createDatabase({connectionString:config.connectionString,binding:{databaseName:config.databaseName,role:config.runtimeRole}})
  try{await db.verifyLogin();const {rows}=await db.query('SELECT publication_id,current_fingerprint,current_sequence FROM economic_calendar.publications ORDER BY publication_id')
   const runs=await db.query('SELECT receipt_ref,provider_id,result FROM economic_calendar.sync_runs ORDER BY receipt_ref')
   return {publications:rows.length,digest:fingerprint(rows),runs:runs.rows.length,receipts:runs.rows.map(r=>({receiptRef:r.receipt_ref,provider:r.provider_id}))}
  }finally{await db.close()}
 }
 const before=await independent(),providers={},seen=new Set();let after=null,pages=0
 const health=await fetch(origin+'/health');const h=await health.json();if(health.status!==200||h.sourceSha!==config.deploymentId)throw Error('ACTUAL_DEPLOYMENT_SHA_MISMATCH')
 do{
  const url=new URL('/v1/organisations/'+org+'/calendar/publications',origin);url.searchParams.set('limit','500');if(after)url.searchParams.set('after',after)
  const r=await fetch(url,{headers:{authorization:'Bearer '+token}}),body=await r.json();if(r.status!==200||!Array.isArray(body.items))throw Error('CURRENT_E1_READBACK_FAILED')
  for(const p of body.items){if(seen.has(p.publicationId))throw Error('DUPLICATE_PUBLICATION_READBACK');seen.add(p.publicationId);const source=p.source
   if(!['eia','commodities-sh'].includes(source?.provider)||source.retentionMode!=='DURABLE_NO_FIXED_EXPIRY'||source.redistribution!=='PRIVATE_AUTHORISED_CONSUMER_ONLY'||!p.observation?.receiptRef)throw Error('LICENSED_PROVENANCE_READBACK_FAILED')
   providers[source.provider]=(providers[source.provider]??0)+1
  }
  const next=body.nextAfter??null;if(next!==null&&(!body.items.length||next===after))throw Error('READBACK_CURSOR_NOT_PROGRESSING');after=next;pages++
 }while(after!==null)
 const reconnected=await independent()
 if(!providers.eia||!providers['commodities-sh']||seen.size!==before.publications||before.digest!==reconnected.digest||before.runs!==reconnected.runs)throw Error('DURABLE_RECONNECT_READBACK_MISMATCH')
 return {kind:'DEVELOPMENT_DURABLE_STORAGE_READBACK',sourceSha:config.deploymentId,providers,pages,independentConnections:2,storedDigest:before.digest,syncRunsBefore:before.runs,syncRunsAfter:reconnected.runs,receipts:before.receipts,currentE1HttpStatus:200,sourceAcquisitionPerformed:false}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)verifyStorage().then(r=>process.stdout.write(JSON.stringify(r)+'\n')).catch(()=>{process.stderr.write('{"error":"DURABLE_STORAGE_READBACK_REFUSED_OR_FAILED"}\n');process.exitCode=1})
