import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import pg from "pg";
import { createHash } from "node:crypto";
import { restoreFinancialDocumentsFromArchive } from "../financial-documents";

test("isolated PostgreSQL: additive financial document migration enforces RLS, foreign write rejection and least privilege", { skip: !process.env.SRM_MIGRATION_TEST_URL }, async () => {
  const url = new URL(process.env.SRM_MIGRATION_TEST_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/srm_migration_test", "Local fixture database only");
  const client = new pg.Client({ connectionString: url.toString() }); await client.connect();
  const orgA = "11111111-1111-4111-8111-111111111111", orgB = "22222222-2222-4222-8222-222222222222";
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA srm_xml_fixture");
    await client.query("CREATE ROLE srm_xml_fixture_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS");
    await client.query("CREATE TABLE srm_xml_fixture.organizations(id uuid PRIMARY KEY)");
    await client.query("INSERT INTO srm_xml_fixture.organizations VALUES($1),($2)", [orgA, orgB]);
    const sql = readFileSync(new URL("../../../db/migrations/0013_financial_source_documents.sql", import.meta.url), "utf8");
    await client.query(sql.replaceAll("srm.", "srm_xml_fixture.").replaceAll("srm_app_runtime", "srm_xml_fixture_runtime"));
    await client.query("GRANT USAGE ON SCHEMA srm_xml_fixture TO srm_xml_fixture_runtime");
    await client.query("SET LOCAL ROLE srm_xml_fixture_runtime");
    await client.query("SELECT set_config('srm_xml_fixture.organization_id',$1,true)", [orgA]);
    const insert = (org: string, id: string) => client.query("INSERT INTO srm_xml_fixture.financial_source_documents(organization_id,nip,record_id,document_json,checksum_sha256,mapping_version) VALUES($1,'6310200831',$2,'{}',repeat('a',64),'fixture')", [org,id]);
    await insert(orgA,"own");
    assert.equal((await client.query("SELECT count(*)::int AS n FROM srm_xml_fixture.financial_source_documents")).rows[0].n,1);
    await client.query("SELECT set_config('srm_xml_fixture.organization_id',$1,true)",[orgB]);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM srm_xml_fixture.financial_source_documents")).rows[0].n,0);
    assert.equal((await client.query("UPDATE srm_xml_fixture.financial_source_documents SET mapping_version='foreign' WHERE record_id='own'")).rowCount,0);
    await client.query("SAVEPOINT foreign_write");
    await assert.rejects(insert(orgA,"foreign"), (error: unknown) => (error as { code: string }).code === "42501");
    await client.query("ROLLBACK TO SAVEPOINT foreign_write");
    assert.equal((await client.query("SELECT has_table_privilege(current_user,'srm_xml_fixture.financial_source_documents','DELETE') AS allowed")).rows[0].allowed,false);
    assert.equal((await client.query("SELECT r.rolbypassrls FROM pg_roles r WHERE rolname=current_user")).rows[0].rolbypassrls,false);
  } finally { await client.query("ROLLBACK"); await client.end(); }
});

test("isolated PostgreSQL: old archives rebuild atomically, reject drift and foreign tenants, and concurrent retry is idempotent", {skip:!process.env.SRM_MIGRATION_TEST_URL}, async () => {
  const url=new URL(process.env.SRM_MIGRATION_TEST_URL!);
  assert.ok(["localhost","127.0.0.1"].includes(url.hostname)&&url.pathname==="/srm_migration_test");
  const admin=new pg.Client({connectionString:url.toString()});await admin.connect();
  const schema="srm_archive_fixture",role="srm_archive_fixture_runtime",orgA="11111111-1111-4111-8111-111111111111",orgB="22222222-2222-4222-8222-222222222222",nip="5213390341";
  const clients:pg.Client[]=[];
  const adapted=(client:pg.Client)=>({query:(sql:string,values?:unknown[])=>client.query(sql.replaceAll("srm.",schema+"."),values)}) as Pick<pg.PoolClient,"query">;
  const source=(id:string)=>({id,identifiers:{pl_nip:nip},document:{type:"financial_statement",period_from_date:"2025-01-01",period_to_date:"2025-12-31",is_ias_compliant:false,is_correction:false,filing_date:"2026-01-01"},content:{schema:{name:"JednostkaInnaWZlotych",version:"1-3"},extracted_fields:{"Bilans.Aktywa.KwotaA":"123.45","RZiS.RZiSPor.A.KwotaA":"456.78"}}});
  const payload=JSON.stringify({pages:[{results:[source("first"),source("second")]}]});
  const legacyHash=createHash("sha256").update(payload).digest("hex");
  try {
    await admin.query("BEGIN");await admin.query(`CREATE SCHEMA ${schema}`);await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    await admin.query(`CREATE TABLE ${schema}.organizations(id uuid PRIMARY KEY)`);await admin.query(`INSERT INTO ${schema}.organizations VALUES($1),($2)`,[orgA,orgB]);
    await admin.query(`CREATE TABLE ${schema}.lookup_requests(organization_id uuid,id uuid,PRIMARY KEY(organization_id,id))`);
    await admin.query(`INSERT INTO ${schema}.lookup_requests VALUES($1,'33333333-3333-4333-8333-333333333333')`,[orgA]);
    for(const name of ['0011_mgbi_raw_reports','0013_financial_source_documents'])await admin.query(readFileSync(new URL('../../../db/migrations/'+name+'.sql',import.meta.url),'utf8').replaceAll('srm.',schema+'.').replaceAll('srm_app_runtime',role));
    await admin.query(`INSERT INTO ${schema}.mgbi_source_archives VALUES($1,$2,'pl-krs-rdf-record',$3::jsonb,$4,2,'2026-10-10T00:00:00Z','2026-10-10T00:00:00Z','33333333-3333-4333-8333-333333333333')`,[orgA,nip,payload,legacyHash]);
    await admin.query(readFileSync(new URL('../../../db/migrations/0016_mgbi_archive_integrity.sql',import.meta.url),'utf8').replaceAll('srm.',schema+'.'));
    await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);await admin.query('COMMIT');
    const original=(await admin.query(`SELECT payload_sha256,payload_jsonb_sha256,first_retrieved_at,last_checked_at FROM ${schema}.mgbi_source_archives`)).rows[0];
    assert.equal(original.payload_sha256,legacyHash);assert.notEqual(original.payload_jsonb_sha256,legacyHash);
    async function connection(org:string){const c=new pg.Client({connectionString:url.toString()});clients.push(c);await c.connect();await c.query('BEGIN');await c.query(`SET LOCAL ROLE ${role}`);await c.query("SELECT set_config($1,$2,true)",[schema+'.organization_id',org]);return c;}
    // Independent transactions can both observe an empty derived table; each commits
    // only its own exact-source upserts. No reset or duplicated document is needed.
    const [a,b]=await Promise.all([connection(orgA),connection(orgA)]);
    const restored=await Promise.all([a,b].map(async c=>{const docs=await restoreFinancialDocumentsFromArchive(adapted(c),orgA,nip);await c.query('COMMIT');return docs;}));
    assert.deepEqual(restored.map(d=>d.map(x=>x.recordId)),[['first','second'],['first','second']]);
    const rows=(await admin.query(`SELECT record_id,ctid::text,checksum_sha256,archive_jsonb_sha256 FROM ${schema}.financial_source_documents ORDER BY record_id`)).rows;
    assert.equal(rows.length,2);assert.ok(rows.every(r=>r.archive_jsonb_sha256===original.payload_jsonb_sha256));
    const retry=await connection(orgA);await restoreFinancialDocumentsFromArchive(adapted(retry),orgA,nip);await retry.query('COMMIT');
    assert.deepEqual((await admin.query(`SELECT record_id,ctid::text,checksum_sha256,archive_jsonb_sha256 FROM ${schema}.financial_source_documents ORDER BY record_id`)).rows,rows);
    assert.deepEqual((await admin.query(`SELECT payload_sha256,payload_jsonb_sha256,first_retrieved_at,last_checked_at FROM ${schema}.mgbi_source_archives`)).rows[0],original);
    const foreign=await connection(orgB);
    assert.deepEqual(await restoreFinancialDocumentsFromArchive(adapted(foreign),orgA,nip),[]);
    await foreign.query('SAVEPOINT foreign_write');
    await assert.rejects(foreign.query(`INSERT INTO ${schema}.financial_source_documents(organization_id,nip,record_id,document_json,checksum_sha256,mapping_version) VALUES($1,$2,'foreign','{}',repeat('a',64),'fixture')`,[orgA,nip]),(e:unknown)=>(e as {code:string}).code==='42501');
    await foreign.query('ROLLBACK');
    const drift=await connection(orgA);await drift.query(`UPDATE ${schema}.mgbi_source_archives SET payload_jsonb_sha256=repeat('a',64)`);
    await assert.rejects(restoreFinancialDocumentsFromArchive(adapted(drift),orgA,nip),/checksum mismatch/);await drift.query('ROLLBACK');
    const damaged=await connection(orgA);await damaged.query(`UPDATE ${schema}.financial_source_documents SET checksum_sha256=repeat('a',64) WHERE record_id='first'`);
    await assert.rejects(restoreFinancialDocumentsFromArchive(adapted(damaged),orgA,nip),/checksum mismatch/);await damaged.query('ROLLBACK');
    const damagedProjection=await connection(orgA);await damagedProjection.query(`UPDATE ${schema}.financial_source_documents SET document_jsonb_sha256=repeat('a',64) WHERE record_id='first'`);
    await assert.rejects(restoreFinancialDocumentsFromArchive(adapted(damagedProjection),orgA,nip),/checksum mismatch/);await damagedProjection.query('ROLLBACK');
    // A new, less complete source must not erase a previously valid XML projection.
    const downgrade=await connection(orgA);const pdfPayload=JSON.stringify({pages:[{results:['first','second'].map(id=>({...source(id),content:{},files:{main_document:{original:{content_type:'application/pdf'}}}}))}]});
    await downgrade.query(`UPDATE ${schema}.mgbi_source_archives SET payload_json=$1::jsonb,payload_sha256=$2 WHERE nip=$3`,[pdfPayload,createHash('sha256').update(pdfPayload).digest('hex'),nip]);
    const preserved=await restoreFinancialDocumentsFromArchive(adapted(downgrade),orgA,nip);
    assert.ok(preserved.every(d=>d.availability==='XML_SUPPORTED'&&d.validation==='VALID'));
    assert.deepEqual((await downgrade.query(`SELECT record_id,ctid::text,checksum_sha256,archive_jsonb_sha256 FROM ${schema}.financial_source_documents ORDER BY record_id`)).rows,rows);await downgrade.query('ROLLBACK');
    // Partial materialization recovers the missing row, retaining existing valid data.
    await admin.query(`DELETE FROM ${schema}.financial_source_documents WHERE record_id='second'`);
    const partial=await connection(orgA);assert.equal((await restoreFinancialDocumentsFromArchive(adapted(partial),orgA,nip)).length,2);await partial.query('COMMIT');
    // Existing pre-upgrade source writer still works without knowing the new column.
    const oldWriter=await connection(orgA);await oldWriter.query(`UPDATE ${schema}.mgbi_source_archives SET payload_json=payload_json WHERE nip=$1`,[nip]);await oldWriter.query('COMMIT');
    assert.deepEqual((await admin.query(`SELECT payload_sha256,payload_jsonb_sha256,first_retrieved_at,last_checked_at FROM ${schema}.mgbi_source_archives`)).rows[0],original);
  } finally {
    for(const c of clients){await c.query('ROLLBACK').catch(()=>{});await c.end();}
    await admin.query('ROLLBACK').catch(()=>{});await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.query(`DROP ROLE IF EXISTS ${role}`);await admin.end();
  }
});
