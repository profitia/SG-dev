import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { enrichMsrFinancial,verifyMsrReceipt,type MsrStore,type MsrReceipt } from "./msr-repository";
import { decodeMsrOriginal,MsrSourceError } from "./msr-source";
import { parseMsrOriginal } from "./msr-parser";
import type { MsrCandidate } from "./msr-financial";
import type { MgbiFinancialResult } from "./mgbi-financial";
const c:MsrCandidate={recordId:"a".repeat(24),nip:"5272443955",from:"2024-01-01",to:"2024-12-31",scope:"standalone",filingDate:null,correction:false,documentId:null};
const hash=(v:string|Buffer)=>createHash("sha256").update(v).digest("hex");
const source=()=>decodeMsrOriginal(c.recordId,Buffer.from('<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:x="http://www.xbrl.org/2003/instance" xmlns:f="https://xbrl.ifrs.org/taxonomy/2022-03-24/ifrs-full" xmlns:iso="http://www.xbrl.org/2003/iso4217"><body><ix:resources><x:context id="c"><x:entity><x:identifier scheme="lei">ISSUER</x:identifier></x:entity><x:period><x:startDate>2024-01-01</x:startDate><x:endDate>2024-12-31</x:endDate></x:period></x:context><x:unit id="u"><x:measure>iso:PLN</x:measure></x:unit></ix:resources><ix:nonFraction name="f:Revenue" contextRef="c" unitRef="u">123</ix:nonFraction></body></html>'),"application/xhtml+xml","2026-10-15T00:00:00Z");
const base=():MgbiFinancialResult=>({section:{status:"EMPTY",data:null,source:{provider:"MGBI",model:"rdf",recordId:null},retrievedAt:"2026-10-14T00:00:00Z",effectiveAt:null,warnings:["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS"]},facts:[],errorCode:null});
function fixture(){
  let receipt:MsrReceipt|null=null,saves=0,claims=0;
  const store:MsrStore={candidates:async()=>({candidates:[c],archiveChecksum:"b".repeat(64)}),read:async()=>receipt,
    claim:async(candidate,id)=>{claims++;if(receipt){if(receipt.state==='DEFERRED'&&receipt.claim_id===id){Object.assign(receipt,{state:'REQUESTED',error_code:null});return true;}return false;}receipt={state:"REQUESTED",identity_sha256:hash(JSON.stringify(candidate)),claim_id:id,original_bytes:null,original_sha256:null,original_format:null,original_container:null,parsed_json:null,parsed_text:null,parsed_sha256:null,mapping_version:null,retrieved_at:null,error_code:null};return true;},
    receive:async(_,__,o)=>{Object.assign(receipt!,{state:"RECEIVED",original_bytes:o.bytes,original_sha256:o.checksum,original_format:o.format,original_container:o.container,retrieved_at:o.retrievedAt});},
    save:async(_,__,o,p)=>{saves++;Object.assign(receipt!,{state:"READY",parsed_json:p,parsed_text:JSON.stringify(p),parsed_sha256:hash(JSON.stringify(p)),mapping_version:p.mappingVersion});},
    block:async(_,__,code)=>{Object.assign(receipt!,{state:["MSR_FILE_BUDGET_EXHAUSTED","MSR_BUDGET_UNAVAILABLE","MSR_PROVIDER_NOT_CONFIGURED"].includes(code)&&receipt?.state==='REQUESTED' ? "DEFERRED" : "BLOCKED",error_code:code});}};
  return {store,get:()=>receipt!,saves:()=>saves,claims:()=>claims};
}
test("MSR first retrieval persists original/facts, repeat cache reuse makes no duplicate paid call",async()=>{
  const f=fixture();let downloads=0;const download=async()=>{downloads++;assert.equal(f.get().state,"REQUESTED");return source();};
  const first=await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download});
  assert.equal(downloads,1);assert.equal(f.get().state,"READY");assert.equal(first.section.status,"SUCCESS");assert.equal(first.facts[0].amount,"123");
  const again=await enrichMsrFinancial("org",c.nip,first,{store:f.store,download});
  assert.equal(downloads,1);assert.equal(f.saves(),1);assert.equal(f.claims(),1);assert.equal(again.msrChanged,false);
});
test("MSR ambiguous charged timeout is durable BLOCKED; ordinary lookup never repeats the download",async()=>{
  const f=fixture();let downloads=0;const download=async()=>{downloads++;throw new MsrSourceError("MSR_FILE_TIMEOUT","file_download");};
  const first=await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download});
  assert.ok(first.section.warnings.includes("MSR_FILE_TIMEOUT"));assert.equal(f.get().state,"BLOCKED");
  await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download});assert.equal(downloads,1);
});
test("MSR interrupted REQUESTED receipt requires reconciliation, while RECEIVED recovers without provider call",async()=>{
  const f=fixture();await f.store.claim(c,"claim");let downloads=0;
  const download=async()=>{downloads++;return source();};
  const wait=await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download});
  assert.ok(wait.section.warnings.includes("MSR_DOWNLOAD_RECONCILIATION_REQUIRED"));assert.equal(downloads,0);
  await f.store.receive(c,"claim",source());
  const recovered=await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download});
  assert.equal(recovered.section.status,"SUCCESS");assert.equal(downloads,0);assert.equal(f.get().state,"READY");
});
test("MSR parsing failure retains licensed bytes and never converts failure to a complete report",async()=>{
  const f=fixture();const result=await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download:async()=>source(),parse:()=>{throw new Error("secret-provider-payload");}});
  assert.equal(f.get().state,"BLOCKED");assert.deepEqual(f.get().original_bytes,source().bytes);assert.equal(result.section.data,null);
  assert.ok(!JSON.stringify(result).includes("secret-provider-payload"));assert.ok(result.section.warnings.includes("MSR_PERSISTENCE_OR_MAPPING_FAILURE"));
});
test("MSR stored receipts fail closed on source/checksum/identity/mapping drift",async()=>{
  const f=fixture();await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download:async()=>source()});
  assert.equal(verifyMsrReceipt(c,f.get())?.parsed.facts[0].amount,"123");
  assert.throws(()=>verifyMsrReceipt({...c,nip:"5252674798"},f.get()),/IDENTITY/);
  for(const patch of [{original_bytes:Buffer.from("corrupt")},{parsed_text:"{}"},{mapping_version:"old"}])assert.throws(()=>verifyMsrReceipt(c,{...f.get(),...patch}),/INTEGRITY/);
  assert.equal(parseMsrOriginal(source()).facts.length,1);
});
test("MSR budget deferral permits a later authorized first download, preserving original claim identity",async()=>{
  const f=fixture();let paid=0;
  await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download:async()=>{throw new MsrSourceError("MSR_FILE_BUDGET_EXHAUSTED","file_budget");}});
  assert.equal(f.get().state,"DEFERRED");const nonce=f.get().claim_id;
  const recovered=await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download:async()=>{paid++;return source();}});
  assert.equal(recovered.section.status,"SUCCESS");assert.equal(paid,1);assert.equal(f.get().claim_id,nonce);
});
test("MSR stale pre-licensing metadata is refreshed before selection; a known PDF costs no file download",async()=>{
  const f=fixture();let refreshed=0,downloaded=0;
  f.store.candidates=async()=>({candidates:refreshed ? [] : [c],archiveChecksum:'b'.repeat(64),metadataMissing:!refreshed});
  const result=await enrichMsrFinancial("org",c.nip,base(),{store:f.store,refreshMetadata:async()=>{refreshed++;},download:async()=>{downloaded++;return source();}});
  assert.equal(refreshed,1);assert.equal(downloaded,0);assert.equal(result.section.status,"EMPTY");
});
