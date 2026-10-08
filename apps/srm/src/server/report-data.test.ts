import assert from "node:assert/strict";
import test from "node:test";
import type { FinancialData, FinancialHistoryPoint } from "@profitia/srm-xray";
import type pg from "pg";
import { calculateFinancialIndicators, FINANCIAL_INDICATOR_CODES, FINANCIAL_INDICATOR_INPUT_CODES, type CatalogIndicatorFact } from "./financial-indicators";
import { FINANCIAL_MAPPING_VERSION } from "./shared-catalog";
import { compareHistoryPoints, projectReportData, readReportData, reportDataHandler, REPORT_DATA_SQL, validateReportSelection, type ReportReadRow, type ReportSelection } from "./report-data";
import { createDemoSession } from "./demo-auth";

const selection = { nip: "8650004194", entityType: "COMPANY" as const };
const now = new Date("2026-10-08T12:00:00Z");
function fixture(years = [2025, 2024], scopes: Array<"standalone" | "consolidated"> = ["standalone"]): ReportReadRow {
  const facts: ReportReadRow["facts"] = [];
  const data: FinancialData = { periods: scopes.flatMap(scope => years.map(year => {
    const from = `${year}-01-01`, to = `${year}-12-31`;
    const values = FINANCIAL_INDICATOR_INPUT_CODES.map((metricCode): CatalogIndicatorFact & { sourceAmount: string } => ({
      metricCode, periodStart: from, periodEnd: to, statementScope: scope === "standalone" ? "UNIT" : "CONSOLIDATED",
      amount: metricCode === "BS_A_CA" ? String(year === 2025 ? 200 : 150) : "100", sourceAmount: "-100",
      currencyCode: "PLN", unitCode: "PLN", sourcePath: `private.provider.path.${metricCode}`,
      validationStatus: "VALID", normalizationRule: metricCode.startsWith("PALA_OAC") || metricCode === "PALA_COGS" ? "VERIFIED_COST_MAGNITUDE_V1" : "SOURCE_VALUE",
      sourceSnapshotId: `00000000-0000-4000-8000-${String(year).padStart(12, "0")}`,
    }));
    facts.push(...values);
    return { from, to, scope, documentId: `private-filing:${year === 2025 ? "cfy" : "pfy"}`,
      facts: values.map(f => ({ metricCode: f.metricCode, amount: f.amount, currency: "PLN", unit: "PLN" })) };
  })) };
  return { nip: selection.nip, financial_json: { status: "SUCCESS", source: { provider: "MGBI", model: "private-model", recordId: "private-record" },
    retrievedAt: "2026-10-01T12:00:00Z", effectiveAt: "2025-12-31", data, warnings: [], catalogMappingVersion: FINANCIAL_MAPPING_VERSION },
    financial_checked_at: "2026-10-07T12:00:00Z", financial_sha256: "a".repeat(64), facts,
    indicators: calculateFinancialIndicators(selection.nip, data, facts), kys: null };
}
function points(row = fixture(), code = "CURRENT_RATIO") { return projectReportData(selection, row, now, {}).financial.history.find(i => i.code === code)!.points; }

test("all 16 codes reuse the stored canonical values, periods, units, reasons and methodology", () => {
  const row = fixture();
  const result = projectReportData(selection, row, now, {});
  assert.deepEqual(result.financial.history.map(i => i.code), [...FINANCIAL_INDICATOR_CODES]);
  for (const series of result.financial.history) for (const point of series.points) {
    const stored = row.indicators.find(i => i.code === point.code && i.periodStart === point.periodStart)!;
    assert.equal(point.value, stored.value, point.code);
    assert.equal(point.unit, stored.unit);
    assert.equal(point.reasonCode, stored.reasonCode);
    assert.equal(point.formulaVersion, stored.formulaVersion);
    assert.equal(point.status, stored.status);
    assert.equal(point.year, point.periodEnd.slice(0, 4));
  }
  assert.deepEqual(points(row).map(p => p.year), ["2025", "2024"]);
  assert.equal(points(row)[0].comparison.delta, "0.500000");
  assert.equal(points(row)[0].comparison.status, "COMPARABLE");
});

test("missing calculations remain null without executing the financial engine", () => {
  const row = fixture(); row.indicators = [];
  for (const series of projectReportData(selection, row, now, {}).financial.history) {
    assert.equal(series.points.length, 2);
    for (const p of series.points) { assert.equal(p.value, null); assert.equal(p.reasonCode, "CALCULATION_NOT_STORED"); }
  }
});

test("freshness uses the successful MGBI check and never renews retrieval or TTL on reads", () => {
  const row = fixture();
  const first = projectReportData(selection, row, now, {}), second = projectReportData(selection, row, new Date("2026-10-09T12:00:00Z"), {});
  assert.equal(first.financial.freshness.retrievedAt, "2026-10-01T12:00:00.000Z");
  assert.equal(first.financial.freshness.checkedAt, "2026-10-07T12:00:00.000Z");
  assert.equal(first.financial.freshness.cacheExpiresAt, "2026-10-14T12:00:00.000Z");
  assert.deepEqual(first.financial.freshness, second.financial.freshness);
  assert.equal(first.financial.freshness.lastRetrievalMethod, "UNKNOWN");
  assert.equal(first.financial.sourceVersion, second.financial.sourceVersion);
  assert.equal(first.financial.representationVersion, second.financial.representationVersion);
  assert.equal(first.kys.freshness.freshness, "ABSENT");
  assert.equal(first.kys.status, "NOT_REQUESTED");
  const expired = projectReportData(selection, row, new Date("2026-10-14T12:00:00Z"), {});
  assert.equal(expired.financial.freshness.freshness, "EXPIRED");
  assert.equal(expired.financial.periods.length, 2);
  assert.equal(projectReportData(selection, row, now, { SRM_MGBI_CACHE_TTL_HOURS: "24" }).financial.freshness.freshness, "EXPIRED");
  row.financial_checked_at = "2027-01-01";
  assert.equal(projectReportData(selection, row, now, {}).financial.freshness.freshness, "UNKNOWN");
  row.financial_checked_at = null;
  assert.equal(projectReportData(selection, row, now, {}).financial.freshness.cacheExpiresAt, null);
  row.financial_checked_at = "invalid";
  assert.equal(projectReportData(selection, row, now, {}).financial.freshness.freshness, "UNKNOWN");
});

test("KYS has independent dates, explicit retention and known retrieval provenance, without person projection", () => {
  const row = fixture();
  row.kys = { attemptStatus: "SUCCESS", attemptAt: "2026-10-07T13:00:10Z", retrievalMethod: "CACHE", retrievedAt: "2026-10-06T13:00:00Z",
    retentionUntil: "2026-10-13T13:00:00Z", isComplete: true, hasProjection: true, currentProjection: true, completionConfirmed: true };
  const output = projectReportData(selection, row, now, {});
  assert.equal(output.kys.freshness.cacheExpiresAt, "2026-10-13T13:00:00.000Z");
  assert.equal(output.kys.freshness.checkedAt, null);
  assert.equal(output.kys.freshness.lastRetrievalMethod, "CACHE");
  assert.equal(output.kys.reportAvailable, true);
  assert.equal(output.kys.completeness, "COMPLETE");
  assert.equal("data" in output.kys, false);
  const shortened = projectReportData(selection, row, now, { SRM_KYS_CACHE_TTL_HOURS: "24" });
  assert.equal(shortened.kys.reportAvailable, false);
  assert.equal(shortened.kys.freshness.freshness, "EXPIRED");
  assert.equal(shortened.financial.freshness.freshness, "FRESH");
  row.kys.completionConfirmed = false;
  const unknown = projectReportData(selection, row, now, {});
  assert.equal(unknown.kys.completeness, "UNKNOWN");
  assert.equal(unknown.kys.status, "PARTIAL");
  assert.deepEqual(unknown.kys.limitations, ["KYS_COMPLETENESS_UNCONFIRMED"]);
  row.kys.currentProjection = false;
  assert.equal(projectReportData(selection, row, now, {}).kys.reportAvailable, false);
  row.kys.retentionUntil = "2026-10-08T12:00:00Z";
  assert.equal(projectReportData(selection, row, now, {}).kys.reportAvailable, false);
  row.kys.retrievedAt = null;
  assert.equal(projectReportData(selection, row, now, {}).kys.freshness.freshness, "UNKNOWN");
});

test("KYS pending, empty, error, timeout and partial are not disguised as complete checks", () => {
  const row = fixture();
  for (const [attemptStatus, expected] of [["PENDING", "PENDING"], ["NO_DATA", "EMPTY"], ["ERROR", "ERROR"], ["TIMEOUT", "ERROR"]] as const) {
    row.kys = { attemptStatus, attemptAt: null, retrievalMethod: "PROVIDER", retrievedAt: null, retentionUntil: null, isComplete: null, hasProjection: false, currentProjection: false, completionConfirmed: false };
    assert.equal(projectReportData(selection, row, now, {}).kys.status, expected);
    assert.equal(projectReportData(selection, row, now, {}).kys.reportAvailable, false);
  }
  row.kys = { attemptStatus: "SUCCESS", attemptAt: null, retrievalMethod: "PROVIDER", retrievedAt: "2026-10-07", retentionUntil: "2026-10-14", isComplete: false, hasProjection: true, currentProjection: true, completionConfirmed: true };
  assert.equal(projectReportData(selection, row, now, {}).kys.status, "PARTIAL");
  assert.equal(projectReportData(selection, row, now, {}).kys.completeness, "PARTIAL");
});

test("differences have exact pp, ratios, PLN and days and no positive/negative assessment", () => {
  const base = points()[0], previous = points()[1];
  for (const [unit, expected] of [["PERCENT", "PERCENTAGE_POINTS"], ["RATIO", "RATIO"], ["PLN", "PLN"], ["DAYS", "DAYS"]] as const) {
    const p = { ...previous, value: "9007199254740993.125000", unit };
    const c = { ...base, value: "9007199254740993.225000", unit };
    assert.deepEqual(compareHistoryPoints(c, p), { status: "COMPARABLE", reasonCode: null, previousPeriod: { from: p.periodStart, to: p.periodEnd }, delta: "0.100000", unit: expected, direction: "UP" });
    assert.equal(compareHistoryPoints({ ...c, value: p.value }, p).direction, "UNCHANGED");
    assert.equal(compareHistoryPoints({ ...c, value: "0.000000" }, { ...p, value: "0.125000" }).delta, "-0.125000");
    assert.equal(compareHistoryPoints({ ...c, value: "0.000000" }, { ...p, value: "0.125000" }).direction, "DOWN");
  }
});

test("gaps, units, scope, methodology, unavailable values and nonannual periods prohibit comparison", () => {
  const current = points()[0], previous = points()[1];
  const cases: Array<[Partial<FinancialHistoryPoint>, string]> = [
    [{ code: "OTHER" }, "INDICATOR_SCOPE_OR_UNIT_MISMATCH"], [{ scope: "consolidated" }, "INDICATOR_SCOPE_OR_UNIT_MISMATCH"],
    [{ unit: "PLN" }, "INDICATOR_SCOPE_OR_UNIT_MISMATCH"], [{ formulaVersion: "1.1" }, "METHODOLOGY_MISMATCH"],
    [{ periodStart: "2024-07-01" }, "PERIOD_NOT_ANNUAL"], [{ periodStart: "2023-01-01", periodEnd: "2023-12-31" }, "NON_ADJACENT_PERIODS"],
    [{ value: null, status: "UNAVAILABLE" }, "VALUE_UNAVAILABLE"],
  ];
  for (const [patch, reason] of cases) { const result = compareHistoryPoints(current, { ...previous, ...patch }); assert.equal(result.reasonCode, reason); assert.equal(result.delta, null); }
  assert.equal(points(fixture([2025, 2023]))[0].comparison.reasonCode, "NON_ADJACENT_PERIODS");
  assert.equal(points(fixture([2025, 2023])).length, 2);
});

test("independent/corrected filings do not receive an invented comparability declaration", () => {
  const row = fixture(); row.financial_json!.data!.periods[1].documentId = "different-filing:cfy";
  row.indicators = calculateFinancialIndicators(selection.nip, row.financial_json!.data!, row.facts);
  const comparison = points(row)[0].comparison;
  assert.equal(comparison.status, "UNKNOWN"); assert.equal(comparison.reasonCode, "DOCUMENT_COMPARABILITY_UNCONFIRMED"); assert.equal(comparison.delta, null);
});

test("quality preserves RAW/source sign and verified normalization; no abs or re-normalization", () => {
  const row = fixture();
  const normalized = projectReportData(selection, row, now, {}).financial.periods[0].facts.find(f => f.metricCode === "PALA_OAC")!;
  assert.equal(normalized.amount, "100"); assert.equal(normalized.sourceAmount, "-100"); assert.equal(normalized.normalization, "NORMALIZED_CONFIRMED");
  const cost = row.facts.find(f => f.metricCode === "PALA_OAC" && f.periodStart === "2025-01-01")!;
  cost.normalizationRule = "UNVERIFIED_COST_SIGN"; cost.validationStatus = "REVIEW";
  const output = projectReportData(selection, row, now, {});
  assert.equal(output.financial.periods[0].facts.find(f => f.metricCode === "PALA_OAC")!.validation, "UNVERIFIED");
  assert.equal(output.financial.history.find(i => i.code === "MATERIALS_ENERGY_SHARE")!.points[0].reasonCode, "STORED_EVIDENCE_MISMATCH");
  assert.equal(output.financial.history.find(i => i.code === "MATERIALS_ENERGY_SHARE")!.points[0].value, null);
});

test("stale or mixed source evidence cannot remain AVAILABLE and public evidence excludes private identifiers", () => {
  for (const mutate of [
    (r: ReportReadRow) => { r.facts.find(f => f.metricCode === "BS_A_CA")!.amount = "999"; },
    (r: ReportReadRow) => { r.facts.find(f => f.metricCode === "BS_A_CA")!.sourceSnapshotId = "another-snapshot"; },
    (r: ReportReadRow) => { r.indicators.find(i => i.code === "CURRENT_RATIO")!.inputFacts[0].documentId = "another-document"; },
    (r: ReportReadRow) => { r.financial_json!.catalogMappingVersion = "old"; },
  ]) {
    const row = fixture(); mutate(row); assert.equal(points(row)[0].value, null); assert.equal(points(row)[0].status, "UNAVAILABLE");
  }
  const output = JSON.stringify(projectReportData(selection, fixture(), now, {}));
  for (const forbidden of ["private-filing", "private.provider.path", "private-record", "sourceSnapshotId", "sourceDocumentIds", "sourcePath", "payload_json", "00000000-0000-4000-8000"]) assert.equal(output.includes(forbidden), false, forbidden);
  assert.ok(points()[0].evidence.length);
  assert.match(points()[0].documentRef, /^[a-f0-9]{64}$/);
  const wrongNip = fixture(); wrongNip.indicators[0].nip = "5213390341";
  assert.throws(() => projectReportData(selection, wrongNip, now, {}), /supplier identity/);
});

test("scope selection is canonical and an unavailable year is not skipped", () => {
  const row = fixture([2025, 2024], ["standalone", "consolidated"]);
  const output = projectReportData(selection, row, now, {});
  assert.equal(output.financial.periods.length, 4);
  for (const point of output.financial.history[0].points) {
    if (point.year === "2025") assert.equal(point.comparison.delta, "0.500000");
    assert.equal(point.evidence.every(e => e.scope === point.scope), true);
  }
  Object.assign(row.indicators.find(i => i.code === "CURRENT_RATIO" && i.periodStart === "2024-01-01" && i.scope === "standalone")!, { status: "UNAVAILABLE", value: null, reasonCode: "MISSING_FIELD" });
  assert.equal(points(row)[0].comparison.reasonCode, "VALUE_UNAVAILABLE");
});

test("content/quality versions are stable on reads and change when evidence changes", () => {
  const row = fixture(); const first = projectReportData(selection, row, now, {});
  row.facts[0].validationStatus = "REVIEW";
  const second = projectReportData(selection, row, now, {});
  assert.equal(first.financial.sourceVersion, second.financial.sourceVersion);
  assert.notEqual(first.financial.representationVersion, second.financial.representationVersion);
  row.financial_sha256 = "b".repeat(64);
  assert.notEqual(first.financial.sourceVersion, projectReportData(selection, row, now, {}).financial.sourceVersion);
});

test("no stored finance and JDG expose explicit unavailable histories, never invented zero", () => {
  const row = fixture(); row.financial_json = null; row.facts = []; row.indicators = [];
  const empty = projectReportData(selection, row, now, {});
  assert.equal(empty.financial.history.length, 16); assert.equal(empty.financial.periods.length, 0);
  assert.ok(empty.financial.history.every(i => i.reasonCode === "NO_STORED_FINANCIAL_PERIODS"));
  const jdg = projectReportData({ ...selection, entityType: "JDG" }, fixture(), now, {});
  assert.equal(jdg.financial.freshness.freshness, "ABSENT");
  assert.ok(jdg.financial.history.every(i => i.reasonCode === "JDG_FINANCIAL_REPORT_NOT_AVAILABLE"));
});

test("stored read uses one parameterized snapshot and tenant context, without writes/providers/calculation", async () => {
  const calls: Array<[string, unknown[] | undefined]> = [];
  const org = "00000000-0000-4000-8000-000000000001";
  const client = { release() {}, async query(sql: string, params?: unknown[]) { calls.push([sql, params]);
    if (sql.includes("current_database")) return { rows: [{ database_name: "srm_app", bypass_rls: false, superuser: false, neon_superuser_member: false }] };
    return { rows: sql === REPORT_DATA_SQL ? [fixture()] : [] };
  } };
  await readReportData(org, selection, now, { connect: async () => client as unknown as pg.PoolClient });
  assert.equal(calls.filter(([sql]) => sql === REPORT_DATA_SQL).length, 1);
  assert.deepEqual(calls.find(([sql]) => sql === REPORT_DATA_SQL)![1], [selection.nip, org, "COMPANY", "1.2"]);
  assert.ok(calls.some(([sql, params]) => sql.includes("set_config") && params?.[0] === org));
  assert.equal(calls.some(([sql]) => /\b(INSERT|UPDATE|DELETE|payload_json)\b/.test(sql)), false);
  assert.match(REPORT_DATA_SQL, /l\.organization_id = \$2::uuid/);
  assert.match(REPORT_DATA_SQL, /l\.entity_type = \$3/);
});

test("public request boundary rejects environment, login, origin, invalid NIP and body-supplied org", async () => {
  const env = { TARGET_ENVIRONMENT: "development", SRM_DEMO_PASSWORD: "fixture-password-at-least-16", SRM_DEMO_SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
    SRM_DEVELOPMENT_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000001" };
  const token = await createDemoSession(env.SRM_DEMO_SESSION_SECRET);
  let calls = 0;
  const read = async (org: string, requested: ReportSelection) => { calls++; assert.equal(org, env.SRM_DEVELOPMENT_ORGANIZATION_ID); assert.deepEqual(requested, selection); return projectReportData(selection, fixture(), now, {}); };
  const request = (body: unknown = { ...selection, organizationId: "attacker" }, origin = "https://srm.test", cookie = token) => new Request("https://srm.test/api/xray/report-data", {
    method: "POST", headers: { origin, cookie: `srm_demo_session=${cookie}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal((await reportDataHandler(read, { ...env, TARGET_ENVIRONMENT: "production" })(request())).status, 404);
  assert.equal((await reportDataHandler(read, env)(request(selection, "https://srm.test", "invalid"))).status, 401);
  assert.equal((await reportDataHandler(read, env)(request(selection, "https://attacker.test"))).status, 403);
  assert.equal((await reportDataHandler(read, env)(request({ nip: "0000000001" }))).status, 400);
  assert.equal(calls, 0);
  const response = await reportDataHandler(read, env)(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store"); assert.equal(calls, 1);
  assert.equal((await reportDataHandler(read, { ...env, SRM_DEVELOPMENT_ORGANIZATION_ID: undefined })(request())).status, 503);
  assert.throws(() => validateReportSelection({ nip: selection.nip, entityType: "OTHER" }));
  const failure = await reportDataHandler(async () => { throw Error("SECRET provider payload"); }, env)(request());
  assert.equal(failure.status, 503); assert.equal((await failure.text()).includes("SECRET"), false);
});


test("Staging report read uses only its own configured tenant and rejects wrong branch or Development fallback", async () => {
  const env = {TARGET_ENVIRONMENT:"staging",SRM_NEON_PROJECT_ID:"snowy-breeze-40315151",SRM_NEON_BRANCH_ID:"br-broad-butterfly-b11t4v01",SRM_STAGING_ORGANIZATION_ID:"00000000-0000-4000-8000-000000000008",SRM_DEVELOPMENT_ORGANIZATION_ID:"00000000-0000-4000-8000-000000000001",SRM_DEMO_PASSWORD:"staging-fixture-password-at-least-16",SRM_DEMO_SESSION_SECRET:"staging-fixture-session-secret-at-least-32"};
  const token = await createDemoSession(env.SRM_DEMO_SESSION_SECRET);
  const request = () => new Request("https://staging.test/api/xray/report-data",{method:"POST",headers:{Origin:"https://staging.test",cookie:"srm_demo_session="+token,"Content-Type":"application/json"},body:JSON.stringify({...selection,organizationId:env.SRM_DEVELOPMENT_ORGANIZATION_ID})});
  let calls = 0;
  const read = async (org:string,requested:ReportSelection) => {calls++;assert.equal(org,env.SRM_STAGING_ORGANIZATION_ID);assert.deepEqual(requested,selection);return projectReportData(selection,fixture(),now,{});};
  assert.equal((await reportDataHandler(read,env)(request())).status,200);
  assert.equal((await reportDataHandler(read,{...env,SRM_NEON_BRANCH_ID:"br-dark-surf-b1vrhda9"})(request())).status,404);
  assert.equal((await reportDataHandler(read,{...env,SRM_STAGING_ORGANIZATION_ID:undefined})(request())).status,503);
  assert.equal(calls,1);
});
