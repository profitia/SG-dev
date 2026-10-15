import assert from "node:assert/strict";
import test from "node:test";
import {projectCompanyGeneralArchive,COMPANY_GENERAL_ARCHIVE_SQL} from "./company-general-cache";
const nip="5850205607",record={id:"public-wp",identifiers:{pl_nip:nip,pl_krs:"0001233591"},content:{current_excerpt:{dane:{dzial1:{danePodmiotu:{nazwa:"ROCKFIN"}}}}}};
const row=()=>({record_count:1,retrieved_at:"2026-10-15T12:00:00Z",valid_checksum:true,records:[record]});
test("legacy identity is reconstructed from a complete verified archive with its original timestamp",()=>{
 const r=projectCompanyGeneralArchive(row(),nip);assert.equal(r.section.data?.krs,"0001233591");assert.equal(r.section.retrievedAt,"2026-10-15T12:00:00.000Z");assert.equal(r.section.data?.registryHistory?.version,"KRS_CONTINUITY_V1");
 assert.match(COMPANY_GENERAL_ARCHIVE_SQL,/organization_id=\$2::uuid/);assert.doesNotMatch(COMPANY_GENERAL_ARCHIVE_SQL,/pl_pesel|nazwisko|daneWspolnikow|opisSposobuPowstania|INSERT|UPDATE|DELETE/);
});
test("corrupt, incomplete and other-NIP archives never become trusted current identity",()=>{
 for(const r of [{...row(),valid_checksum:false},{...row(),record_count:2},{...row(),records:[{...record,identifiers:{...record.identifiers,pl_nip:"1234567890"}}]}])assert.throws(()=>projectCompanyGeneralArchive(r,nip),/integrity mismatch/);
});
