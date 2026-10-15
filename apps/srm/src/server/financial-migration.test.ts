import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { withOrganization } from "./db";
import { createLookup } from "./xray-repository";
import { readCompanyRegistration, readSupplierRegistrationStatus } from "./company-activity";
import { mapMgbiFinancialRecords } from "./mgbi-financial";
import { readFreshCompany, FINANCIAL_MAPPING_VERSION } from "./shared-catalog";
import { migrationManifest, runMigrations } from "../../scripts/staging-migrate.mjs";

test("PostgreSQL: forward migration preserves history, accepts reconciled COGS, rejects false magnitude and enforces tenant isolation with SELECT-only organization access", { skip: !process.env.SRM_MIGRATION_TEST_URL }, async () => {
  const base = new URL(process.env.SRM_MIGRATION_TEST_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(base.hostname) && base.pathname === "/srm_migration_test", "Only the isolated local migration test database is allowed");
  const admin = new pg.Client({ connectionString: base.toString() });
  await admin.connect();
  const database = new URL(base); database.pathname = "/srm_app";
  const owner = new pg.Client({ connectionString: database.toString() });
  let created = false; let runtimeCreated = false; let neonCreated = false;
  const organizationId = "00000000-0000-4000-8000-000000000008";
  const foreignId = "00000000-0000-4000-8000-000000000009";
  const runtimeUrl = new URL(database); runtimeUrl.username = "srm_app_runtime"; runtimeUrl.password = "isolated-local-only-password-at-least-32";
  const pool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 1 });
  try {
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_database WHERE datname='srm_app'")).rows[0].n, 0, "Never adopt or erase an existing database");
    await admin.query("CREATE DATABASE srm_app"); created = true;
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='neon_superuser'")).rows.length) {
      await admin.query("CREATE ROLE neon_superuser NOLOGIN"); neonCreated = true;
    }
    await owner.connect();
    const manifest = migrationManifest();
    // Establish the historical ledger first, then apply the new migration.
    if (!(await owner.query("SELECT 1 FROM pg_roles WHERE rolname='srm_app_runtime'")).rows.length) {
      await owner.query("CREATE ROLE srm_app_runtime LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'isolated-local-only-password-at-least-32'"); runtimeCreated = true;
    }
    for (const m of manifest.slice(0, -1)) {
      await owner.query(m.sql);
      await owner.query("INSERT INTO srm.schema_migrations(version,checksum_sha256) VALUES($1,$2)", [m.version, m.checksum]);
    }
    const before = (await owner.query("SELECT version,checksum_sha256 FROM srm.schema_migrations ORDER BY version")).rows;
    assert.equal((await runMigrations(owner)).applied.length, 1);
    assert.deepEqual((await owner.query("SELECT version,checksum_sha256 FROM srm.schema_migrations WHERE version<>$1 ORDER BY version", [manifest.at(-1)!.version])).rows, before);
    assert.equal((await runMigrations(owner)).applied.length, 0);
    await owner.query("GRANT USAGE ON SCHEMA srm TO srm_app_runtime");
    await owner.query("GRANT SELECT ON srm.organizations TO srm_app_runtime");
    await owner.query("GRANT SELECT,INSERT,UPDATE ON srm.suppliers,srm.lookup_requests TO srm_app_runtime");
    await owner.query("INSERT INTO srm.organizations(id,slug) VALUES($1,'fixture-a'),($2,'fixture-b')", [organizationId, foreignId]);
    assert.equal((await owner.query("SELECT has_table_privilege('srm_app_runtime','srm.organizations','INSERT') AS can_insert")).rows[0].can_insert, false);
    const company = await createLookup(organizationId, { type: "NIP", value: "1111111111" }, "COMPANY", pool);
    const jdg = await createLookup(organizationId, { type: "NIP", value: "2222222222" }, "JDG", pool);
    const other = await createLookup(foreignId, { type: "NIP", value: "3333333333" }, "COMPANY", pool);
    await withOrganization(organizationId, async client => {
      const requests = await client.query("SELECT organization_id,entity_type FROM srm.lookup_requests ORDER BY entity_type");
      assert.deepEqual(requests.rows.map(row => row.entity_type), ["COMPANY", "JDG"]);
      assert.ok(requests.rows.every(row => row.organization_id === organizationId));
      assert.equal((await client.query("SELECT count(*)::int AS n FROM srm.suppliers WHERE id=$1", [other.supplierId])).rows[0].n, 0);
    }, pool);
    await assert.rejects(createLookup("00000000-0000-4000-8000-000000000099", { type: "NIP", value: "4444444444" }, "COMPANY", pool), /stage failed/);
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM srm.organizations")).rows[0].n, 2);
    const attempt = (await owner.query("INSERT INTO srm.provider_attempts(organization_id,request_id,section,provider,attempt_no,status) VALUES($1,$2,'financial','MGBI',1,'PENDING') RETURNING id", [organizationId, company.requestId])).rows[0].id;
    const snapshot = (await owner.query("INSERT INTO srm.source_snapshots(organization_id,attempt_id,supplier_id,section,payload_json,payload_sha256,data_class,retrieved_at) VALUES($1,$2,$3,'financial','{}',repeat('a',64),'FINANCIAL',now()) RETURNING id", [organizationId, attempt, company.supplierId])).rows[0].id;
    const mapped = mapMgbiFinancialRecords([{ id: "same-document", identifiers: { pl_nip: "1111111111" }, document: { type: "financial_statement", period_from_date: "2025-01-01", period_to_date: "2025-12-31" }, content: { schema: { name: "JednostkaInnaWZlotych" }, extracted_fields: { "RZiS.RZiSKalk.A.KwotaA": "1000", "RZiS.RZiSKalk.B.KwotaA": "-600", "RZiS.RZiSKalk.C.KwotaA": "400" } } }], { type: "NIP", value: "1111111111" }, new Date().toISOString());
    const cogs = mapped.facts.find(fact => fact.metricCode === "PALA_COGS")!;
    assert.equal(cogs.amount, "600"); assert.equal(cogs.sourceAmount, "-600");
    const insert = (metric: string, magnitude: string | null, source: string | null, rule = "VERIFIED_COST_MAGNITUDE_V1", status = "VALID") => owner.query("INSERT INTO srm.financial_facts(organization_id,supplier_id,snapshot_id,metric_code,period_start,period_end,period_type,statement_scope,amount,source_amount,normalization_rule,currency_code,unit_code,source_path,validation_status) VALUES($1,$2,$3,$4,'2025-01-01','2025-12-31','YEAR','UNIT',$5,$6,$7,'PLN','PLN','fixture',$8)", [organizationId,company.supplierId,snapshot,metric,magnitude,source,rule,status]);
    for (const metric of ["PALA_COGS", "PALA_OAC", "PALA_OAC_MAEC", "PALA_OOC", "PALA_FC", "PALA_IT"]) await insert(metric,cogs.amount,cogs.sourceAmount,cogs.normalizationRule);
    for (const args of [["PALA_COGS","-600","-600"],["PALA_COGS","601","-600"],["PALA_COGS","600",null],["PALA_NET_SALES","600","600"]] as const) {
      await assert.rejects(insert(args[0], args[1], args[2]), (error: unknown) => (error as { code: string }).code === "23514");
    }
    await insert("PALA_OAC_UNRESOLVED", "-20", "-20", "UNVERIFIED_COST_SIGN", "REVIEW");
    await owner.query("INSERT INTO srm.catalog_companies(nip) VALUES('1111111111')");
    await owner.query("INSERT INTO srm.catalog_financial_facts(nip,metric_code,period_start,period_end,statement_scope,period_type,amount,source_amount,normalization_rule,currency_code,unit_code,source_path,validation_status,retrieved_at) VALUES('1111111111','PALA_COGS','2025-01-01','2025-12-31','UNIT','YEAR',600,-600,'VERIFIED_COST_MAGNITUDE_V1','PLN','PLN','fixture','VALID',now())");
    await assert.rejects(owner.query("UPDATE srm.catalog_financial_facts SET amount=601 WHERE metric_code='PALA_COGS'"), (error: unknown) => (error as { code: string }).code === "23514");
    assert.ok(company.supplierId !== jdg.supplierId);
    const archivedCompany = { id: "archive-registration", identifiers: { pl_nip: "1111111111" }, content: { current_excerpt: null,
      full_excerpt: { naglowekP: { stanPozycji: 2, wpis: [{ numerWpisu: 20, opis: "WYKREŚLENIE Z KRAJOWEGO REJESTRU SĄDOWEGO", dataWpisu: "19.01.2009" }] } } } };
    await owner.query("INSERT INTO srm.mgbi_source_archives(organization_id,nip,model,payload_json,payload_sha256,record_count,first_retrieved_at,last_checked_at,source_request_id) VALUES($1,'1111111111','pl-krs-wp-record',$2,repeat('b',64),1,now(),now(),$3)", [organizationId, JSON.stringify({ pages: [{ results: [archivedCompany] }] }), company.requestId]);
    assert.deepEqual(await readCompanyRegistration(organizationId,"1111111111",pool),{status:"DEREGISTERED",deregisteredAt:"2009-01-19"});
    assert.deepEqual(await readCompanyRegistration(foreignId,"1111111111",pool),{status:"UNKNOWN",deregisteredAt:null});
    await owner.query("GRANT SELECT ON srm.section_projections,srm.source_snapshots TO srm_app_runtime");
    const jdgAttempt=(await owner.query("INSERT INTO srm.provider_attempts(organization_id,request_id,section,provider,attempt_no,status) VALUES($1,$2,'jdg','CEIDG',1,'PENDING') RETURNING id",[organizationId,jdg.requestId])).rows[0].id;
    const jdgSnapshot=(await owner.query("INSERT INTO srm.source_snapshots(organization_id,attempt_id,supplier_id,section,payload_json,payload_sha256,data_class,retrieved_at,retention_until) VALUES($1,$2,$3,'jdg','{}',repeat('c',64),'JDG_REGISTRY',now(),now()+interval '30 days') RETURNING id",[organizationId,jdgAttempt,jdg.supplierId])).rows[0].id;
    await owner.query("INSERT INTO srm.section_projections(organization_id,supplier_id,snapshot_id,section,projection_version,data_json) VALUES($1,$2,$3,'jdg',1,$4)",[organizationId,jdg.supplierId,jdgSnapshot,JSON.stringify({entries:[{status:"Wykreślony",fields:[{key:"dataWykreslenia",value:"2018-08-18"}]}]})]);
    assert.equal(await readSupplierRegistrationStatus(organizationId,"2222222222","JDG",pool),"DEREGISTERED");
    assert.equal(await readSupplierRegistrationStatus(foreignId,"2222222222","JDG",pool),"UNKNOWN");
    // The same NIP and shared person-free catalog never authorize another tenant's archive.
    await owner.query("UPDATE srm.catalog_companies SET general_json=$1,general_sha256=repeat('d',64),general_checked_at=now(),general_source_organization_id=$2,general_source_snapshot_id=$3 WHERE nip='1111111111'",[JSON.stringify({source:{recordId:"different-record"}}),organizationId,snapshot]);
    assert.deepEqual(await readCompanyRegistration(organizationId,"1111111111",pool),{status:"UNKNOWN",deregisteredAt:null});
    // A formerly selected deleted KRS must not hide a verified current successor.
    const registry=(krs:string,active:boolean,previous?:string)=>({id:"wp-"+krs,identifiers:{pl_nip:"1111111111",pl_krs:krs},content:{
      current_excerpt:active?{naglowekA:{numerKRS:krs,stanPozycji:1},dane:{dzial1:{danePodmiotu:{nazwa:"Current company"},sposobPowstaniaPodmiotu:{okolicznosciPowstania:"PRZEKSZTAŁCENIE",podmioty:[{krs:{krs:previous}}]}}}}:null,
      full_excerpt:{naglowekP:{numerKRS:krs,stanPozycji:active?1:2,wpis:active?[]:[{numerWpisu:2,opis:"WYKREŚLENIE Z KRAJOWEGO REJESTRU SĄDOWEGO",dataWpisu:"19.01.2009"}]}}}});
    const archivePayload=JSON.stringify({pages:[{results:[registry("0000000001",false),registry("0000000002",true,"0000000001")]}]});
    await owner.query("UPDATE srm.mgbi_source_archives SET payload_json=$1,record_count=2 WHERE organization_id=$2 AND nip='1111111111'",[archivePayload,organizationId]);
    const oldGeneral={status:"PARTIAL",source:{provider:"MGBI",model:"pl-krs-wp-record",recordId:"wp-0000000001"},data:{nip:"1111111111",krs:"0000000001",registrationStatus:"DEREGISTERED"},warnings:[],retrievedAt:new Date().toISOString()};
    const financial={status:"EMPTY",source:{provider:"MGBI",model:"pl-krs-rdf-record",recordId:null},data:null,warnings:[],catalogMappingVersion:FINANCIAL_MAPPING_VERSION};
    await owner.query("UPDATE srm.catalog_companies SET general_json=$1,financial_json=$2,financial_sha256=repeat('e',64),general_checked_at=now(),financial_checked_at=now() WHERE nip='1111111111'",[JSON.stringify(oldGeneral),JSON.stringify(financial)]);
    const restored=await readFreshCompany(organizationId,"1111111111",new Date(),pool);
    assert.equal(restored?.generalReprojected,true);assert.equal(restored?.general.data?.krs,"0000000002");assert.equal(restored?.general.data?.registrationStatus,"ACTIVE");
    assert.equal(restored?.general.data?.registryHistory?.members.length,2);
    assert.equal(await readFreshCompany(foreignId,"1111111111",new Date(),pool),null,"Shared catalog does not expose another tenant's source archive");
    assert.equal((await owner.query("SELECT payload_json::text AS payload FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip='1111111111'",[organizationId])).rows.length,1);
    assert.equal((await owner.query("SELECT general_json->'data'->>'krs' AS krs FROM srm.catalog_companies WHERE nip='1111111111'")).rows[0].krs,"0000000001","Reading reprojects without overwriting the historical catalog or archive");
  } finally {
    await pool.end(); await owner.end();
    try {
      if (created) await admin.query("DROP DATABASE srm_app");
      if (runtimeCreated) await admin.query("DROP ROLE srm_app_runtime");
      if (neonCreated) await admin.query("DROP ROLE neon_superuser");
    } finally { await admin.end(); }
  }
});
