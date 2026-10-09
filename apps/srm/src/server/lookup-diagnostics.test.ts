import assert from "node:assert/strict";
import test from "node:test";
import { atLookupStage, logLookupFailure, logProviderOutcome, sanitizedLookupFailure, withLookupDiagnostics } from "./lookup-diagnostics";

test("permission and financial constraint diagnostics distinguish actual persistence stages", async () => {
  for (const [code, category] of [["42501", "DATABASE_PERMISSION"], ["23514", "FINANCIAL_CONSTRAINT"]]) {
    let error: unknown;
    try { await atLookupStage("financial_persistence", async () => { throw Object.assign(new Error("secret personal detail"), { code, constraint: "financial_facts_verified_cost_magnitude_check", detail: "private payload" }); }, "financial"); } catch (cause) { error = cause; }
    const result = sanitizedLookupFailure(error);
    assert.equal(result.code, code); assert.equal(result.category, category); assert.equal(result.stage, "financial_persistence");
    assert.equal(result.constraint, "financial_facts_verified_cost_magnitude_check");
    assert.doesNotMatch(JSON.stringify(result), /secret|personal|private/);
  }
});

test("sanitized logs share a generated request ID and never include provider bodies, credentials or personal identifiers", async () => {
  const lines: string[] = []; const error = console.error; const info = console.info;
  console.error = console.info = (line: string) => { lines.push(line); };
  try {
    await withLookupDiagnostics(async () => {
      for (const code of ["HTTP_401", "HTTP_403", "HTTP_429", "TIMEOUT", "INVALID_JSON"]) logProviderOutcome("MGBI", "financial", "ERROR", code);
      logProviderOutcome("VERCLY", "kys", "ERROR", "Bearer api-key 12345678901 raw KYS payload");
      logLookupFailure({ code: "23514", message: "connection postgres://password", detail: "5213390341", constraint: "12345678901" });
    });
  } finally { console.error = error; console.info = info; }
  assert.equal(new Set(lines.map(line => JSON.parse(line).requestId)).size, 1);
  assert.deepEqual(lines.slice(0, 5).map(line => JSON.parse(line).category), ["PROVIDER_AUTHENTICATION", "PROVIDER_ENTITLEMENT", "PROVIDER_RATE_LIMIT", "PROVIDER_TIMEOUT", "SERIALIZATION_OR_MAPPING"]);
  assert.doesNotMatch(lines.join(""), /api-key|12345678901|5213390341|raw KYS|password|postgres:\/\//);
});
