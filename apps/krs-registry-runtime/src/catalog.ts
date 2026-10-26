import {diagnosticAsync} from '@profitia/platform-contracts/diagnostic-phase'
import type {Pool,PoolClient} from 'pg'
import {canonical,sha256,demand,krs,nip,validateCompanySnapshot} from '@profitia/krs-registry-contracts'
import type {CompanySnapshot,Coverage,Register,SearchResult,CompanyCandidate} from '@profitia/krs-registry-contracts'
import {normalizeSearch,nameTokens} from './normalizer.js'
import {RegistryError} from './errors.js'
const escapeLike=(v:string)=>v.replace(/[\\%_]/g,'\\$&')
export const SEARCH_SQL=`WITH matches AS (
 SELECT n.krs,min(CASE WHEN n.name=$1 THEN 0 WHEN n.normalized=$2 THEN 1 WHEN n.normalized LIKE $3 ESCAPE '\\' THEN 2 ELSE 3 END + CASE WHEN n.historical THEN 4 ELSE 0 END)::integer AS rank,
 bool_and(n.historical) AS historical
 FROM krs_registry.names n
 WHERE n.normalized=$2 OR n.normalized LIKE $3 ESCAPE '\\' OR ($4::boolean AND n.normalized LIKE $5 ESCAPE '\\')
 GROUP BY n.krs
), page AS (SELECT * FROM matches WHERE (rank,krs)>($6::integer,$7::text) ORDER BY rank,krs LIMIT $8)
 SELECT c.*,s.source_version,s.retrieved_at,p.rank,p.historical
 FROM page p JOIN krs_registry.companies c USING(krs) JOIN krs_registry.snapshots s ON s.evidence_ref=c.latest_ref ORDER BY p.rank,p.krs`
export class Catalog {
  constructor(readonly pool:Pool){}
  async read(id:string,register?:Register):Promise<CompanySnapshot|null>{
 return diagnosticAsync(register==='P'?'KRS_CATALOG_P':register==='S'?'KRS_CATALOG_S':'KRS_CATALOG_MAIN',async ()=>{
    demand(krs(id),'INVALID_KRS')
    const r=register?await this.pool.query('SELECT s.payload FROM krs_registry.company_sources c JOIN krs_registry.snapshots s USING(evidence_ref) WHERE c.krs=$1 AND c.register=$2 AND c.extract=$3',[id,register,'CURRENT']):await this.pool.query('SELECT s.payload FROM krs_registry.companies c JOIN krs_registry.snapshots s ON s.evidence_ref=c.latest_ref WHERE c.krs=$1',[id])
    return r.rows[0]?.payload??null

 })
}
  async accepted(ref:string):Promise<CompanySnapshot|null>{
 return diagnosticAsync('KRS_CATALOG_ACCEPTED',async ()=>{return (await this.pool.query('SELECT payload FROM krs_registry.snapshots WHERE evidence_ref=$1',[ref])).rows[0]?.payload??null
 })
}
  async byNip(value:string):Promise<string[]>{
 return diagnosticAsync('KRS_CATALOG_NIP',async ()=>{
    demand(nip(value),'INVALID_NIP')
    const r=await this.pool.query("SELECT DISTINCT i.krs FROM krs_registry.identifiers i JOIN krs_registry.company_sources c ON c.evidence_ref=i.evidence_ref WHERE i.kind='NIP' AND i.value=$1 AND i.valid AND i.removed_entry IS NULL AND c.extract='CURRENT' ORDER BY i.krs LIMIT 101",[value]);return r.rows.map(r=>r.krs)

 })
}
  async coverage(query:Pool|PoolClient=this.pool):Promise<Coverage>{
    const r=await query.query('SELECT m.*, (SELECT count(*)::int FROM krs_registry.companies WHERE latest_ref IS NOT NULL) AS count,(SELECT max(retrieved_at) FROM krs_registry.snapshots) AS last FROM krs_registry.metadata m')
    const m=r.rows[0];return {scope:'PROGRESSIVE',asOf:m.last?.toISOString()??null,bootstrapReference:m.bootstrap_reference,pendingChanges:null,observedCompanies:m.count,totalCompanies:null}
  }
  async search(input:{query:string;limit?:number;cursor?:string}):Promise<SearchResult>{
    demand(typeof input.query==='string'&&input.query.length<=200&&input.query.trim().length>=1,'INVALID_SEARCH')
    const normalized=normalizeSearch(input.query),limit=input.limit??20;demand(normalized.length>=1&&Number.isInteger(limit)&&limit>=1&&limit<=50,'INVALID_SEARCH')
    const fingerprint=await sha256(canonical({normalized,limit}));let lastRank=-1,lastKrs='',cursorGeneration:string|null=null
    if(input.cursor){demand(input.cursor.length<=1024,'INVALID_CURSOR');let c:unknown;try{c=JSON.parse(Buffer.from(input.cursor,'base64url').toString('utf8'))}catch{throw new RegistryError('INVALID_CURSOR')}
      const v=c as {generation:string;fingerprint:string;rank:number;krs:string};demand(Object.keys(v).sort().join(',')==='fingerprint,generation,krs,rank'&&typeof v.generation==='string'&&v.fingerprint===fingerprint&&Number.isInteger(v.rank)&&v.rank>=0&&v.rank<=7&&krs(v.krs),'INVALID_CURSOR');lastRank=v.rank;lastKrs=v.krs;cursorGeneration=v.generation
    }
    const connection=await this.pool.connect()
    try{
      await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await connection.query("SET LOCAL statement_timeout='3s'")
      const generation=(await connection.query('SELECT generation::text FROM krs_registry.metadata')).rows[0].generation
      if(cursorGeneration!==null&&cursorGeneration!==generation)throw new RegistryError('CATALOG_CHANGED_RESTART_SEARCH')
      const r=await connection.query(SEARCH_SQL,[input.query,normalized,escapeLike(normalized)+'%',normalized.length>=3,'%'+escapeLike(normalized)+'%',lastRank,lastKrs,limit+1])
      const rows=r.rows.slice(0,limit),last=rows.at(-1),coverage=await this.coverage(connection)
      await connection.query('COMMIT')
      const candidates:CompanyCandidate[]=rows.map(r=>({entityKey:r.entity_key,krs:r.krs,officialName:r.official_name,nip:r.nip,regon:r.regon,locality:r.locality,state:r.state,historicalNameMatch:r.historical,sourceVersion:r.source_version,retrievedAt:r.retrieved_at.toISOString(),financiallyVerified:false}))
      return {status:candidates.length?'SUCCESS':'NOT_IN_CATALOG',candidates,coverage,nextCursor:r.rows.length>limit&&last?Buffer.from(JSON.stringify({generation,fingerprint,rank:last.rank,krs:last.krs})).toString('base64url'):null}
    }catch(e){await connection.query('ROLLBACK');throw e}finally{connection.release()}
  }
}
/** Must run inside the producer's admitted publication transaction, never a pool-level write. */
export async function storeSnapshot(tx:PoolClient,snapshot:CompanySnapshot,effectRef:string):Promise<string>{
  snapshot=await validateCompanySnapshot(snapshot)
  const {contract,version,source,evidenceRef,...facts}=snapshot
  demand(contract==='profitia.krs-registry'&&version==='1.0.0'&&krs(snapshot.canonicalKrs)&&source.provider==='KRS'&&source.sourceRecordId===snapshot.canonicalKrs&&snapshot.entityKey==='PL:KRS:'+snapshot.canonicalKrs)
  demand(await sha256(canonical(facts))===source.contentDigest,'CONTENT_DIGEST_MISMATCH');demand(effectRef.length>=1&&effectRef.length<=256)
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['krs:'+snapshot.canonicalKrs])
  const replay=await tx.query('SELECT evidence_ref,content_digest FROM krs_registry.snapshots WHERE effect_ref=$1',[effectRef])
  if(replay.rows[0]){demand(replay.rows[0].content_digest===source.contentDigest,'INTENT_CONTENT_CONFLICT');return replay.rows[0].evidence_ref}
  await tx.query("INSERT INTO krs_registry.companies(krs,entity_key,state) VALUES($1,$2,'UNKNOWN') ON CONFLICT DO NOTHING",[snapshot.canonicalKrs,snapshot.entityKey])
  const current=(await tx.query('SELECT s.payload FROM krs_registry.company_sources c JOIN krs_registry.snapshots s USING(evidence_ref) WHERE c.krs=$1 AND c.register=$2 AND c.extract=$3',[snapshot.canonicalKrs,source.register,source.extract])).rows[0]?.payload as CompanySnapshot|undefined
  if(current&&Date.parse(current.source.retrievedAt)>Date.parse(source.retrievedAt))throw new RegistryError('OUT_OF_ORDER_OBSERVATION')
  await tx.query('INSERT INTO krs_registry.snapshots(evidence_ref,krs,register,extract,source_version,raw_digest,content_digest,retrieved_at,effect_ref,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[evidenceRef,snapshot.canonicalKrs,source.register,source.extract,source.sourceVersion,source.rawDigest,source.contentDigest,source.retrievedAt,effectRef,JSON.stringify(snapshot)])
  await tx.query('INSERT INTO krs_registry.company_sources(krs,register,extract,evidence_ref) VALUES($1,$2,$3,$4) ON CONFLICT(krs,register,extract) DO UPDATE SET evidence_ref=EXCLUDED.evidence_ref',[snapshot.canonicalKrs,source.register,source.extract,evidenceRef])
  if(source.extract==='CURRENT'){
    await tx.query('UPDATE krs_registry.companies SET official_name=$2,nip=$3,regon=$4,locality=$5,state=$6,latest_ref=$7 WHERE krs=$1',[snapshot.canonicalKrs,snapshot.officialName,snapshot.nip,snapshot.regon,snapshot.address?.city??null,snapshot.state,evidenceRef])
    // Old aliases remain historical instead of being deleted on provider corrections.
    await tx.query('UPDATE krs_registry.names SET historical=true WHERE krs=$1',[snapshot.canonicalKrs])
  }
  for(const name of snapshot.names)for(const normalized of nameTokens(name.name)){
    await tx.query('INSERT INTO krs_registry.names(krs,name,normalized,historical,evidence_ref) VALUES($1,$2,$3,$4,$5) ON CONFLICT(krs,normalized,name) DO UPDATE SET historical=krs_registry.names.historical AND EXCLUDED.historical,evidence_ref=EXCLUDED.evidence_ref',[snapshot.canonicalKrs,name.name,normalized,source.extract==='FULL'||name.removedEntry!==null||name.name!==snapshot.officialName,evidenceRef])
  }
  for(const id of snapshot.identifiers)await tx.query('INSERT INTO krs_registry.identifiers(krs,kind,value,valid,evidence_ref,introduced_entry,removed_entry) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[snapshot.canonicalKrs,id.kind,id.value,id.valid,evidenceRef,id.introducedEntry,id.removedEntry])
  await tx.query('UPDATE krs_registry.metadata SET generation=generation+1')
  return evidenceRef
}
