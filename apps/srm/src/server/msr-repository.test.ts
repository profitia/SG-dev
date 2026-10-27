import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { enrichMsrFinancial,verifyMsrReceipt,recoverStoredMsrSource,type MsrStore,type MsrReceipt } from "./msr-repository";
import { MSR_PROJECTION_VERSION } from "./msr-financial";
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
test('main MGBI policy blocks a new unknown-format purchase before claiming or calling the provider',async()=>{
  const f=fixture();let calls=0;
  const result=await enrichMsrFinancial('org',c.nip,base(),{store:f.store,requireLicensedXmlMetadata:true,download:async()=>{calls++;return source();}});
  assert.equal(calls,0);assert.equal(f.claims(),0);assert.equal(f.get(),null);
  assert.equal(result.section.status,'EMPTY');assert.ok(result.section.warnings.includes('MGBI_FINANCIAL_UNKNOWN_FORMAT'));
});
test('main MGBI policy accepts evidenced XML and reuses historical READY and RECEIVED originals without fresh metadata or purchase',async()=>{
  const f=fixture();let calls=0;
  f.store.candidates=async()=>({candidates:[c],archiveChecksum:'b'.repeat(64),licensedXmlRecordIds:[c.recordId]});
  const first=await enrichMsrFinancial('org',c.nip,base(),{store:f.store,requireLicensedXmlMetadata:true,download:async()=>{calls++;return source();}});
  const receipt=JSON.stringify(f.get());
  f.store.candidates=async()=>({candidates:[c],archiveChecksum:'b'.repeat(64)});
  const cached=await enrichMsrFinancial('org',c.nip,first,{store:f.store,requireLicensedXmlMetadata:true,download:async()=>{throw Error('paid retry');}});
  assert.equal(cached.section.status,'SUCCESS');assert.equal(JSON.stringify(f.get()),receipt);assert.equal(calls,1);
  const interrupted=fixture();await interrupted.store.claim(c,'original-claim');await interrupted.store.receive(c,'original-claim',source());
  const recovered=await enrichMsrFinancial('org',c.nip,base(),{store:interrupted.store,requireLicensedXmlMetadata:true,download:async()=>{throw Error('paid retry');}});
  assert.equal(recovered.section.status,'SUCCESS');assert.equal(interrupted.get().claim_id,'original-claim');
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

test("a newer projection of READY source is appended without changing receipt or downloading again",async()=>{
  const f=fixture();await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download:async()=>source()});
  const before=JSON.stringify(f.get());let projects=0;
  f.store.project=async(_c,p)=>{projects++;assert.equal(p.document.mappingVersion,MSR_PROJECTION_VERSION);};
  await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download:async()=>{throw Error("paid retry");}});
  assert.equal(projects,1);assert.equal(JSON.stringify(f.get()),before);
});
test("verified legacy DTD-blocked original can be reprojected without resetting or retrying the paid receipt",async()=>{
  const f=fixture();await f.store.claim(c,"claim");await f.store.receive(c,"claim",source());await f.store.block(c,"claim","MSR_XML_DTD_EXCLUDED");
  const before=JSON.stringify(f.get());let projects=0;f.store.project=async()=>{projects++;};
  const result=await enrichMsrFinancial("org",c.nip,base(),{store:f.store,download:async()=>{throw Error("paid retry");}});
  assert.equal(projects,1);assert.equal(result.facts[0].amount,"123");assert.equal(JSON.stringify(f.get()),before);
});

for(const code of ['MSR_XHTML_ENTITY_UNCONFIRMED','MSR_CONTINUATION_INVALID']) test(`stored ${code} recovery preserves original, claim and failed receipt; repeated projections are idempotent`,async()=>{
  const f=fixture();await f.store.claim(c,'claim');await f.store.receive(c,'claim',source());await f.store.block(c,'claim',code);
  const before=JSON.stringify(f.get()),projects=new Map<string,string>();let downloads=0;
  f.store.project=async(candidate,projection)=>{const key=candidate.recordId+projection.document.mappingVersion,json=JSON.stringify(projection);if(projects.has(key))assert.equal(projects.get(key),json);projects.set(key,json);};
  for(let i=0;i<2;i++) {
    const cached=base();cached.section.warnings=[...cached.section.warnings,code];
    const result=await enrichMsrFinancial('org',c.nip,cached,{store:f.store,download:async()=>{downloads++;throw Error('forbidden paid retry');}});
    assert.equal(result.section.status,'SUCCESS');assert.equal(result.facts[0].amount,'123');
    assert.ok(!result.section.warnings.includes(code));
  }
  assert.equal(downloads,0);assert.equal(projects.size,1);assert.equal(JSON.stringify(f.get()),before);
});
test('stored recovery does not accept unknown failures, corrupted bytes, changed identity or a parser rejection',async()=>{
  const f=fixture();await f.store.claim(c,'claim');await f.store.receive(c,'claim',source());await f.store.block(c,'claim','MSR_CONTINUATION_INVALID');
  const row=f.get();
  for(const code of ['MSR_FILE_TIMEOUT','MSR_DOWNLOAD_RECONCILIATION_REQUIRED','MSR_PERSISTENCE_OR_MAPPING_FAILURE'])assert.equal(recoverStoredMsrSource(c,{...row,error_code:code}),null);
  for(const patch of [{original_bytes:Buffer.from('corrupt')},{identity_sha256:'f'.repeat(64)},{original_bytes:null}])assert.throws(()=>recoverStoredMsrSource(c,{...row,...patch}),/INTEGRITY/);
  assert.throws(()=>recoverStoredMsrSource({...c,nip:'5252674798'},row),/INTEGRITY/);
  assert.throws(()=>recoverStoredMsrSource(c,row,()=>{throw Error('still invalid');}),/still invalid/);
});
test('verified historical parser version remains readable without overwriting stored facts',async()=>{
  const f=fixture();await enrichMsrFinancial('org',c.nip,base(),{store:f.store,download:async()=>source()});
  const parsed={...f.get().parsed_json!,mappingVersion:'2026-10-15-ixbrl-v1'},raw=JSON.stringify(parsed);
  const legacy={...f.get(),mapping_version:parsed.mappingVersion,parsed_json:parsed,parsed_text:raw,parsed_sha256:hash(raw)};
  assert.equal(verifyMsrReceipt(c,legacy)!.parsed.mappingVersion,'2026-10-15-ixbrl-v1');
  assert.throws(()=>verifyMsrReceipt(c,{...legacy,mapping_version:'unreviewed'}),/INTEGRITY/);
});

test('bounded MSR work preserves stored originals and continues remaining documents without another download',async()=>{
 const second={...c,recordId:'b'.repeat(24)},a=fixture(),b=fixture(),get=(candidate:MsrCandidate)=>candidate.recordId===c.recordId?a.store:b.store
 const store:MsrStore={candidates:async()=>({candidates:[c,second],archiveChecksum:'b'.repeat(64)}),
  read:async candidate=>get(candidate).read(candidate),claim:async(candidate,id)=>get(candidate).claim(candidate,id),
  receive:async(candidate,id,value)=>get(candidate).receive(candidate,id,value),save:async(candidate,id,original,parsed,projection,checksum)=>get(candidate).save(candidate,id,original,parsed,projection,checksum),
  block:async(candidate,id,code)=>get(candidate).block(candidate,id,code)}
 let downloads=0
 const download=async(id:string)=>{downloads++;return decodeMsrOriginal(id,source().bytes,'application/xhtml+xml','2026-10-15T00:00:00Z')}
 const first=await enrichMsrFinancial('org',c.nip,base(),{store,download,maximumNewDownloads:1})
 assert.equal(downloads,1);assert(first.section.warnings.includes('MSR_PROCESSING_PENDING'));assert.equal(b.claims(),0)
 const next=await enrichMsrFinancial('org',c.nip,base(),{store,download,maximumNewDownloads:1})
 assert.equal(downloads,2);assert(!next.section.warnings.includes('MSR_PROCESSING_PENDING'));assert.equal(a.get().state,'READY');assert.equal(b.get().state,'READY')
 await enrichMsrFinancial('org',c.nip,base(),{store,download,maximumNewDownloads:1});assert.equal(downloads,2)
})
