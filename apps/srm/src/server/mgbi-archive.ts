import {diagnosticRun} from './diagnostic-trace'
import { createHash } from "node:crypto";
import { withOrganization, type DatabasePool } from "./db";
import type {PoolClient} from 'pg';

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
type PageShape = Readonly<{nodeCount:number;depth:number}>;
type PreparedMgbiPages = Readonly<PageShape & {pages:unknown[];recordCount:number;payload:string;digest:string;byteLength:number}>;
const ownedPages=new WeakMap<unknown[],{shape:PageShape;recordCount:number;prepared?:PreparedMgbiPages}>();

/** Private immutable DATA only, never Source acceptance or permission evidence.
 * Only this reader's JSON.parse results can enter the index. Frozen caller
 * objects and archived/deserialized data retain the ordinary capture path. */
export function readPreparedMgbiPages(pages:unknown[],recordCount:number):PreparedMgbiPages|undefined {
  const owned=ownedPages.get(pages);
  if(!owned||owned.recordCount!==recordCount)return undefined;
  if(!owned.prepared){
    const payload=JSON.stringify({pages});
    owned.prepared=Object.freeze({...owned.shape,pages,recordCount,payload,
      digest:createHash('sha256').update(payload).digest('hex'),byteLength:Buffer.byteLength(payload)});
  }
  return owned.prepared;
}

// Parsing creates plain own data properties. Freeze that exclusively owned
// tree directly, rather than later copying every property descriptor again.
// The shape counts use the same value-node/depth convention as finite capture.
function parsePage(text:string):{body:unknown;shape:PageShape}{
  let nodeCount=0,depth=0;
  const visit=(value:unknown,level:number):void=>{
    if(++nodeCount>1000000||level>128)throw RangeError('MGBI JSON shape limit exceeded');
    depth=Math.max(depth,level);
    if(typeof value==='number'){
      if(!Number.isFinite(value))throw TypeError('Non-finite MGBI JSON');
    }
    if(value&&typeof value==='object'){
      const data=value as Record<string,unknown>;
      for(const key of Object.keys(data)){
        const child=data[key];if(Object.is(child,-0))data[key]=0;
        visit(child,level+1);
      }
      Object.freeze(value);
    }
  };
  const body=JSON.parse(text) as unknown;visit(body,0);
  return {body,shape:{nodeCount,depth}};
}
export type MgbiModel = "pl-krs-wp-record" | "pl-krs-rdf-record";
export type PersistedMgbiArchive = {organization_id:string;nip:string;model:MgbiModel;payload_text:string;
  payload_jsonb_sha256:string;record_count:number;pages_match:boolean};
const persistedArchives=new WeakMap<PersistedMgbiArchive,{client:Pick<PoolClient,'query'>;pages:unknown[];digest:string}>();
/** Once-only data receipt from the actual writer, never an authority grant. */
export function takePersistedMgbiArchive(value:PersistedMgbiArchive|undefined,client:Pick<PoolClient,'query'>,pages:unknown[]):PersistedMgbiArchive|undefined {
  if(!value)return undefined;
  const receipt=persistedArchives.get(value);persistedArchives.delete(value);
  return receipt?.client===client&&receipt.pages===pages
    &&(readPreparedMgbiPages(pages,value.record_count)?.digest
      ??createHash('sha256').update(JSON.stringify({pages})).digest('hex'))===receipt.digest?value:undefined;
}
export type MgbiPages = { pages: unknown[]; records: unknown[]; count: number; errorCode: null }
  | { pages: []; records: []; count: 0; errorCode: string };

/** Fetch every page of a model search; an incomplete response is never archived as complete. */
export async function fetchMgbiPages(url: URL, headers: HeadersInit, signal: AbortSignal,
  fetcher: typeof fetch = fetch): Promise<MgbiPages> {
  const pages: unknown[] = [];
  const records: unknown[] = [];
  let count: number | null = null;
  let expectedPages: number | null = null;
  let pageNodes=0,pageDepth=0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set("per_page", String(PAGE_SIZE));
    pageUrl.searchParams.set("page", String(page));
    const response = await fetcher(pageUrl, { method: "GET", headers, signal, cache: "no-store" });
    if (!response.ok) return { pages: [], records: [], count: 0, errorCode: `HTTP_${response.status}` };
    let body: unknown;let shape:PageShape;
    try { ({body,shape}=parsePage(await response.text())); } catch { return { pages: [], records: [], count: 0, errorCode: "INVALID_JSON" }; }
    if (!body || typeof body !== "object" || Array.isArray(body)) return { pages: [], records: [], count: 0, errorCode: "INVALID_RESPONSE" };
    const value = body as Record<string, unknown>;
    if (!Array.isArray(value.results)) return { pages: [], records: [], count: 0, errorCode: "INVALID_RESPONSE" };
    if (page === 1) {
      if (typeof value.count === "number" && Number.isSafeInteger(value.count) && value.count >= 0) count = value.count;
      if (typeof value.pages === "number" && Number.isSafeInteger(value.pages) && value.pages >= 0) expectedPages = value.pages;
      if (expectedPages !== null && expectedPages > MAX_PAGES) return { pages: [], records: [], count: 0, errorCode: "RESULT_LIMIT" };
      if (count !== null && count > PAGE_SIZE * MAX_PAGES) return { pages: [], records: [], count: 0, errorCode: "RESULT_LIMIT" };
    }
    pages.push(body);
    pageNodes+=shape.nodeCount;pageDepth=Math.max(pageDepth,shape.depth);
    records.push(...value.results);
    if (expectedPages !== null ? page >= expectedPages
      : count !== null ? records.length >= count : value.results.length < PAGE_SIZE) {
      if (count !== null && records.length < count) return { pages: [], records: [], count: 0, errorCode: "INCOMPLETE_RESPONSE" };
      Object.freeze(pages);Object.freeze(records);
      ownedPages.set(pages,{recordCount:records.length,shape:{nodeCount:1+pageNodes,depth:1+pageDepth}});
      return { pages, records, count: records.length, errorCode: null };
    }
    if (!value.results.length) return { pages: [], records: [], count: 0, errorCode: "INCOMPLETE_RESPONSE" };
  }
  return { pages: [], records: [], count: 0, errorCode: "RESULT_LIMIT" };
}

/** The complete API payload stays tenant-scoped; only mapped person-free facts enter the shared catalog. */
export async function saveMgbiArchive(organizationId: string, nip: string, model: MgbiModel,
  pages: unknown[], recordCount: number, retrievedAt: string, sourceRequestId: string, pool?: DatabasePool,
  onStored?:(archive:PersistedMgbiArchive)=>void): Promise<void> {
 return diagnosticRun('SOURCE_ARCHIVE',async ()=>{
  if (!/^\d{10}$/.test(nip) || !pages.length || !Number.isSafeInteger(recordCount) || recordCount < 0) {
    throw new Error("A complete MGBI response and NIP are required for archiving");
  }
  const prepared=readPreparedMgbiPages(pages,recordCount);
  const payload = prepared?.payload??JSON.stringify({ pages });
  const digest = prepared?.digest??createHash("sha256").update(payload).digest("hex");
  await withOrganization(organizationId, async (client) => {
    const result=await client.query<PersistedMgbiArchive>(
      `INSERT INTO srm.mgbi_source_archives(organization_id, nip, model, payload_json, payload_sha256,
         record_count, first_retrieved_at, last_checked_at, source_request_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $7, $8)
       ON CONFLICT (organization_id, nip, model) DO UPDATE SET
         payload_json = CASE WHEN srm.mgbi_source_archives.payload_sha256 IS DISTINCT FROM EXCLUDED.payload_sha256
           THEN EXCLUDED.payload_json ELSE srm.mgbi_source_archives.payload_json END,
         payload_sha256 = EXCLUDED.payload_sha256, record_count = EXCLUDED.record_count,
         last_checked_at = EXCLUDED.last_checked_at, source_request_id = EXCLUDED.source_request_id`+
         (onStored?` RETURNING organization_id,nip,model,payload_json::text AS payload_text,
           payload_jsonb_sha256,record_count,payload_json->'pages'=($4::jsonb->'pages') AS pages_match`:''),
      [organizationId, nip, model, payload, digest, recordCount, new Date(retrievedAt), sourceRequestId],
    );
    if(onStored&&result.rows.length===1){const row=Object.freeze(result.rows[0]);persistedArchives.set(row,{client,pages,digest});onStored(row);}
  }, pool);

 })
}
