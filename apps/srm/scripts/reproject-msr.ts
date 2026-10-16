/** Offline projection of already licensed immutable originals. No provider calls.
 * Default: dry run. --apply appends only a new projection; user lookup refreshes
 * the shared effective financial dataset via the normal governed pipeline. */
import { getPool } from "../src/server/db";
import { productOrganizationId } from "../src/server/runtime-environment";
import { msrStore,verifyMsrReceipt,recoverStoredMsrSource } from "../src/server/msr-repository";
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
    const recovered=verified??recoverStoredMsrSource(c,receipt);
    if(!recovered)throw Error("SOURCE_NOT_REPROJECTABLE");
    const projection=projectMsrFinancial(c,recovered.original,recovered.parsed);
    if(args.includes("--apply"))await store.project!(c,projection,archive.archiveChecksum);
    console.log(JSON.stringify({nip,scope:c.scope,version:projection.document.mappingVersion,periods:projection.data.periods.length,facts:projection.facts.length,applied:args.includes("--apply")}));
  }
}
main().catch(()=>{console.error("MSR_REPROJECTION_FAILED_CLOSED; inspect governed source evidence without logging credentials");process.exitCode=1;}).finally(async()=>{try{await getPool().end();}catch{/* Configuration failures must not expose credentials. */}});
