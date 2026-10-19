import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { withOrganization, type DatabasePool } from "./db";
import { persistFinancialDocuments, projectArchivedFinancialDocuments, financialRecordsFromPages, type FinancialArchive } from "./financial-documents";
import { MSR_PROJECTION_VERSION, selectMsrCandidates, projectMsrFinancial, mergeMsrFinancial, type MsrCandidate, type MsrProjection } from "./msr-financial";
import { MSR_READABLE_MAPPING_VERSIONS, parseMsrOriginal, MsrParserError, type MsrParsed } from "./msr-parser";
import { decodeMsrOriginal, downloadMsrOriginal, MsrSourceError, type MsrOriginal } from "./msr-source";
import type { MgbiFinancialResult } from "./mgbi-financial";
import { logMsrOutcome } from "./lookup-diagnostics";

type Client = Pick<PoolClient,"query">;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const identity = (c: MsrCandidate) => hash(JSON.stringify(c));
export type MsrReceipt = { state:"REQUESTED"|"RECEIVED"|"READY"|"BLOCKED"|"DEFERRED"; identity_sha256:string; claim_id:string;
  original_bytes:Buffer|null; original_sha256:string|null; original_format:"XHTML"|"XBRL"|null;
  original_container:"ZIP"|"DOCUMENT"|null; parsed_json:MsrParsed|null; parsed_text:string|null;
  parsed_sha256:string|null; mapping_version:string|null; retrieved_at:Date|string|null; error_code:string|null };

/** Committed write-ahead claim. ON CONFLICT never resets an uncertain provider call. */
export async function claimMsrSource(client: Client, organizationId:string, candidate:MsrCandidate, claimId:string,requestId:string):Promise<boolean> {
  const result = await client.query(
    `INSERT INTO srm.msr_sources(organization_id,nip,record_id,identity_sha256,claim_id,source_request_id,state)
     VALUES ($1,$2,$3,$4,$5,$6,'REQUESTED') ON CONFLICT (organization_id,nip,record_id) DO UPDATE SET state='REQUESTED',error_code=NULL
     WHERE srm.msr_sources.state='DEFERRED' AND srm.msr_sources.original_bytes IS NULL
       AND srm.msr_sources.identity_sha256=EXCLUDED.identity_sha256 AND srm.msr_sources.claim_id=EXCLUDED.claim_id
       AND srm.msr_sources.error_code IN ('MSR_FILE_BUDGET_EXHAUSTED','MSR_BUDGET_UNAVAILABLE','MSR_PROVIDER_NOT_CONFIGURED') RETURNING record_id`,
    [organizationId,candidate.nip,candidate.recordId,identity(candidate),claimId,requestId]);
  return result.rows.length === 1;
}

export function verifyMsrReceipt(candidate:MsrCandidate, row:MsrReceipt): {original:MsrOriginal;parsed:MsrParsed} | null {
  if (row.identity_sha256 !== identity(candidate)) throw new Error("MSR_SOURCE_IDENTITY_MISMATCH");
  if (row.state !== "READY") return null;
  if (!row.original_bytes || row.original_sha256 !== hash(row.original_bytes) || !row.parsed_text
      || row.parsed_sha256 !== hash(row.parsed_text) || !row.parsed_json || row.parsed_json.sourceChecksum !== row.original_sha256
      || !row.mapping_version || !MSR_READABLE_MAPPING_VERSIONS.has(row.mapping_version) || row.parsed_json.mappingVersion !== row.mapping_version
      || !row.original_format || !row.original_container || !row.retrieved_at) throw new Error("MSR_STORED_INTEGRITY_FAILURE");
  return { original:{recordId:candidate.recordId,bytes:row.original_bytes,checksum:row.original_sha256,
    format:row.original_format,container:row.original_container,files:[],retrievedAt:new Date(row.retrieved_at).toISOString()}, parsed:row.parsed_json };
}

/** MSR_PARSER_RECOVERY_V1: only evidenced parser failures with an intact original.
 * This never resets a receipt, retries a provider call, or relaxes the new parser. */
export function recoverStoredMsrSource(candidate:MsrCandidate,row:MsrReceipt,parse= parseMsrOriginal):{original:MsrOriginal;parsed:MsrParsed}|null {
  if(row.state!=="BLOCKED" || !["MSR_XML_DTD_EXCLUDED","MSR_XHTML_ENTITY_UNCONFIRMED","MSR_CONTINUATION_INVALID"].includes(row.error_code ?? "")) return null;
  if(row.identity_sha256!==identity(candidate) || !row.original_bytes || hash(row.original_bytes)!==row.original_sha256
    || !row.retrieved_at || !row.original_format || !row.original_container) throw Error("MSR_STORED_INTEGRITY_FAILURE");
  const original=decodeMsrOriginal(candidate.recordId,row.original_bytes,row.original_container==="ZIP"?"application/zip":"application/xhtml+xml",new Date(row.retrieved_at).toISOString());
  if(original.checksum!==row.original_sha256 || original.format!==row.original_format || original.container!==row.original_container)throw Error("MSR_STORED_INTEGRITY_FAILURE");
  return {original,parsed:parse(original,candidate)};
}

export type MsrStore = {
  candidates():Promise<{candidates:MsrCandidate[];archiveChecksum:string;metadataMissing?:boolean}|null>;
  claim(candidate:MsrCandidate,claimId:string):Promise<boolean>;
  read(candidate:MsrCandidate):Promise<MsrReceipt|null>;
  receive(candidate:MsrCandidate,claimId:string,original:MsrOriginal):Promise<void>;
  save(candidate:MsrCandidate,claimId:string,original:MsrOriginal,parsed:MsrParsed,projection:MsrProjection,archiveChecksum:string):Promise<void>;
  project?(candidate:MsrCandidate,projection:MsrProjection,archiveChecksum:string):Promise<void>;
  block(candidate:MsrCandidate,claimId:string,code:string):Promise<void>;
};
export function msrStore(organizationId:string,nip:string,requestId:string,allowedKrs?:readonly string[],pool?:DatabasePool):MsrStore {
  return {
    candidates:() => withOrganization(organizationId, async client => {
      const archive = (await client.query<FinancialArchive>(
        "SELECT organization_id,nip,model,payload_json::text AS payload_text,payload_jsonb_sha256,record_count FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record'", [organizationId,nip])).rows[0];
      if (!archive) return null;
      projectArchivedFinancialDocuments(archive,organizationId,nip); // checksum, complete inventory and supplier identity
      const records=financialRecordsFromPages(JSON.parse(archive.payload_text).pages),candidates=selectMsrCandidates(records,nip,allowedKrs);
      return {candidates,archiveChecksum:archive.payload_jsonb_sha256,metadataMissing:candidates.some(c=>records.some(r=>{
        const v=r as Record<string,unknown>;return v.id===c.recordId && !Object.hasOwn(v,'files');
      }))};
    },pool),
    claim:(c,id) => withOrganization(organizationId,client => claimMsrSource(client,organizationId,c,id,requestId),pool),
    read:c => withOrganization(organizationId,async client => (await client.query<MsrReceipt>(
      "SELECT *,parsed_json::text AS parsed_text FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2 AND record_id=$3", [organizationId,nip,c.recordId])).rows[0] ?? null,pool),
    receive:(c,id,original) => withOrganization(organizationId,async client => {
      const result = await client.query(
        `UPDATE srm.msr_sources SET state='RECEIVED',original_bytes=$5,original_sha256=$6,original_format=$7,original_container=$8,retrieved_at=$9
         WHERE organization_id=$1 AND nip=$2 AND record_id=$3 AND claim_id=$4 AND state='REQUESTED' AND identity_sha256=$10 RETURNING record_id`,
        [organizationId,nip,c.recordId,id,original.bytes,original.checksum,original.format,original.container,original.retrievedAt,identity(c)]);
      if (result.rows.length !== 1) throw new Error("MSR_SOURCE_FENCE_CONFLICT");
    },pool),
    save:(c,id,original,parsed,projection,archiveChecksum) => withOrganization(organizationId,async client => {
      const result = await client.query(
        `UPDATE srm.msr_sources SET state='READY',original_bytes=$5,original_sha256=$6,original_format=$7,original_container=$8,
         parsed_json=$9::jsonb,parsed_sha256=encode(sha256(convert_to(($9::jsonb)::text,'UTF8')),'hex'),mapping_version=$10,retrieved_at=$11
         WHERE organization_id=$1 AND nip=$2 AND record_id=$3 AND claim_id=$4 AND state='RECEIVED' AND identity_sha256=$12 RETURNING record_id`,
        [organizationId,nip,c.recordId,id,original.bytes,original.checksum,original.format,original.container,JSON.stringify(parsed),parsed.mappingVersion,original.retrievedAt,identity(c)]);
      if (result.rows.length !== 1) throw new Error("MSR_SOURCE_FENCE_CONFLICT");
      const verified = await persistMsrProjection(client,organizationId,c,projection);
      await persistFinancialDocuments(client,organizationId,nip,[projection.document],archiveChecksum,verified);
    },pool),
    project:(c,projection,archiveChecksum) => withOrganization(organizationId,async client => {
      const verified = await persistMsrProjection(client,organizationId,c,projection);
      await persistFinancialDocuments(client,organizationId,nip,[projection.document],archiveChecksum,verified);
    },pool),
    block:(c,id,code) => withOrganization(organizationId, async client => { await client.query(
      `UPDATE srm.msr_sources SET state=CASE WHEN state='REQUESTED' AND $5 IN ('MSR_FILE_BUDGET_EXHAUSTED','MSR_BUDGET_UNAVAILABLE','MSR_PROVIDER_NOT_CONFIGURED') THEN 'DEFERRED' ELSE 'BLOCKED' END,
       error_code=$5 WHERE organization_id=$1 AND nip=$2 AND record_id=$3 AND claim_id=$4 AND state IN ('REQUESTED','RECEIVED')`, [organizationId,nip,c.recordId,id,code]); },pool),
  };
}

/** One download per record for the lifetime of its receipt, including ambiguous failures.
 * A blocked receipt needs explicit evidence-based operator reconciliation, never cache deletion. */
export async function enrichMsrFinancial(organizationId:string,nip:string,base:MgbiFinancialResult,
  options:{requestId?:string;store?:MsrStore;download?:typeof downloadMsrOriginal;parse?:typeof parseMsrOriginal;refreshMetadata?:()=>Promise<void>;allowedKrs?:readonly string[]} = {}):Promise<MgbiFinancialResult & {msrChanged:boolean}> {
  if(!options.store && !options.requestId)throw new Error("MSR_LOOKUP_CONTEXT_REQUIRED");
  const store = options.store ?? msrStore(organizationId,nip,options.requestId!,options.allowedKrs);let archive = await store.candidates();
  if(archive?.metadataMissing && options.refreshMetadata){await options.refreshMetadata();archive=await store.candidates();}
  if (!archive?.candidates.length) return {...base,msrChanged:false};
  const projections:MsrProjection[] = [], warnings:string[] = [], resolvedWarnings:string[] = [];
  let changed = false;
  for (const candidate of archive.candidates) {
    const existing = await store.read(candidate);
    if (existing && existing.state !== "RECEIVED" && existing.state !== "DEFERRED") {
      const saved = verifyMsrReceipt(candidate,existing);
      if (saved) {
        const projection = projectMsrFinancial(candidate,saved.original,saved.parsed);
        await store.project?.(candidate,projection,archive.archiveChecksum);
        projections.push(projection);
        logMsrOutcome("CACHE",null);
      } else if(existing.state === "BLOCKED" && store.project) {
        try {
          const recovered=recoverStoredMsrSource(candidate,existing,options.parse);
          if(recovered) {
            const projection=projectMsrFinancial(candidate,recovered.original,recovered.parsed);
            await store.project(candidate,projection,archive.archiveChecksum);
            projections.push(projection);
            resolvedWarnings.push(existing.error_code!);
            warnings.push(...recovered.parsed.warnings);
            logMsrOutcome("CACHE",null);
          } else warnings.push(existing.error_code ?? "MSR_SOURCE_BLOCKED");
        } catch(error) {
          const code=error instanceof MsrParserError ? error.code
            : error instanceof Error && error.message==="MSR_STORED_INTEGRITY_FAILURE" ? error.message : "MSR_PERSISTENCE_OR_MAPPING_FAILURE";
          warnings.push(code);logMsrOutcome("CACHE",code);
        }
      } else { warnings.push(existing.state === "REQUESTED" ? "MSR_DOWNLOAD_RECONCILIATION_REQUIRED" : existing.error_code ?? "MSR_SOURCE_BLOCKED"); }
      continue;
    }
    const claimId = existing?.claim_id ?? randomUUID();
    if ((!existing || existing.state === "DEFERRED") && !await store.claim(candidate,claimId)) {warnings.push("MSR_DOWNLOAD_IN_PROGRESS");continue;}
    try {
      const received=existing?.state === "RECEIVED" ? existing : null;
      if (received && (received.identity_sha256 !== identity(candidate) || !received.original_bytes
          || hash(received.original_bytes) !== received.original_sha256 || !received.retrieved_at)) throw new Error("MSR_SOURCE_IDENTITY_MISMATCH");
      const original = received ? decodeMsrOriginal(candidate.recordId,received.original_bytes!,"application/zip",new Date(received.retrieved_at!).toISOString())
        : await (options.download ?? downloadMsrOriginal)(candidate.recordId);
      // Keep the successfully received licensed original even if parsing or projection fails.
      if (!received) await store.receive(candidate,claimId,original);
      const parsed = (options.parse ?? parseMsrOriginal)(original,candidate), projection = projectMsrFinancial(candidate,original,parsed);
      // A durable original+full parsed source and document projection commit atomically.
      await store.save(candidate,claimId,original,parsed,projection,archive.archiveChecksum);
      projections.push(projection); changed = true; logMsrOutcome("PROVIDER",null);
    } catch (error) {
      const code = error instanceof MsrSourceError || error instanceof MsrParserError ? error.code
        : error instanceof Error && ["MSR_SOURCE_IDENTITY_MISMATCH","MSR_PERIOD_IDENTITY_MISMATCH","MSR_NO_NUMERIC_STATEMENT"].includes(error.message) ? error.message : "MSR_PERSISTENCE_OR_MAPPING_FAILURE";
      await store.block(candidate,claimId,code);
      warnings.push(code); logMsrOutcome("PROVIDER",code);
    }
  }
  // The failed receipt remains historical evidence. Only its successfully
  // resolved current warning is removed; another failing candidate re-adds it.
  const currentBase={...base,section:{...base.section,warnings:base.section.warnings.filter(w=>!resolvedWarnings.includes(w))}};
  const merged = mergeMsrFinancial(currentBase,projections,warnings);
  // A previously persisted original can reconstruct a missing public projection without downloading it.
  const before = JSON.stringify(base.section.data?.periods ?? []), after = JSON.stringify(merged.section.data?.periods ?? []);
  return {...merged,msrChanged:changed || before !== after};
}

/** Append a projection of the verified licensed original. Same version must be
 * byte-equivalent in JSONB; a changed mapping requires a new version. */
export async function persistMsrProjection(client:Client,organizationId:string,c:MsrCandidate,projection:MsrProjection):Promise<{version:string;checksum:string}> {
  const payload=JSON.stringify(projection);
  await client.query(`INSERT INTO srm.msr_projections(organization_id,nip,record_id,projection_version,original_sha256,projection_json,projection_sha256)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,encode(sha256(convert_to(($6::jsonb)::text,'UTF8')),'hex')) ON CONFLICT DO NOTHING`,
    [organizationId,c.nip,c.recordId,MSR_PROJECTION_VERSION,projection.document.checksum,payload]);
  const saved=await client.query(`SELECT 1 FROM srm.msr_projections WHERE organization_id=$1 AND nip=$2 AND record_id=$3 AND projection_version=$4
    AND original_sha256=$5 AND projection_json=$6::jsonb AND projection_sha256=encode(sha256(convert_to(projection_json::text,'UTF8')),'hex')`,
    [organizationId,c.nip,c.recordId,MSR_PROJECTION_VERSION,projection.document.checksum,payload]);
  if(saved.rows.length!==1)throw new Error("MSR_PROJECTION_VERSION_CONFLICT");
  return {version:MSR_PROJECTION_VERSION,checksum:projection.document.checksum};
}
