/** Offline projection of already licensed immutable originals. No provider calls.
 * Default: dry run. --apply appends only a new projection; user lookup refreshes
 * the shared effective financial dataset via the normal governed pipeline. */
import { createHash } from "node:crypto";
import { getPool } from "../src/server/db";
import { productOrganizationId } from "../src/server/runtime-environment";
import { msrStore,verifyMsrReceipt } from "../src/server/msr-repository";
import { decodeMsrOriginal } from "../src/server/msr-source";
import { parseMsrOriginal } from "../src/server/msr-parser";
import { projectMsrFinancial } from "../src/server/msr-financial";

async function main(){
  if(process.env.TARGET_ENVIRONMENT!=="development")throw Error("DEVELOPMENT_ONLY");
  const args=process.argv.slice(2),nip=args.find(a=>/^\d{10}$/.test(a));
  if(!nip || args.some(a=>a!==nip&&a!=="--apply"))throw Error("Usage: reproject-msr.ts NIP [--apply]");
  const organizationId=productOrganizationId();
  if(!organizationId)throw Error("CONFIGURED_ORGANIZATION_REQUIRED");
  const store=msrStore(organizationId,nip,"offline-no-provider");
  const archive=await store.candidates();if(!archive)throw Error("NO_VERIFIED_SOURCE_ARCHIVE");
  for(const c of archive.candidates){
    const receipt=await store.read(c);if(!receipt)throw Error("ORIGINAL_NOT_ALREADY_STORED");
    const verified=verifyMsrReceipt(c,receipt);
    let original=verified?.original,parsed=verified?.parsed;
    if(!verified){
      if(receipt.state!=="BLOCKED"||receipt.error_code!=="MSR_XML_DTD_EXCLUDED"||!receipt.original_bytes||!receipt.retrieved_at||
        createHash("sha256").update(receipt.original_bytes).digest("hex")!==receipt.original_sha256)throw Error("SOURCE_NOT_REPROJECTABLE");
      original=decodeMsrOriginal(c.recordId,receipt.original_bytes,"application/xhtml+xml",new Date(receipt.retrieved_at).toISOString());
      parsed=parseMsrOriginal(original,c);
    }
    const projection=projectMsrFinancial(c,original!,parsed!);
    if(args.includes("--apply"))await store.project!(c,projection,archive.archiveChecksum);
    console.log(JSON.stringify({nip,scope:c.scope,version:projection.document.mappingVersion,periods:projection.data.periods.length,facts:projection.facts.length,applied:args.includes("--apply")}));
  }
}
main().catch(()=>{console.error("MSR_REPROJECTION_FAILED_CLOSED; inspect governed source evidence without logging credentials");process.exitCode=1;}).finally(async()=>{try{await getPool().end();}catch{/* Configuration failures must not expose credentials. */}});
