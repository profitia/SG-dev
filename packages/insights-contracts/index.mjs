import { createHash } from "node:crypto";
export const CONTRACT = "procurement-insights.report/1.0";
export const OPERATIONS = Object.freeze({
  start: "insights.report.start",
  status: "insights.report.status",
  list: "insights.report.list",
  download: "insights.report.download",
});
export const SECTIONS = Object.freeze([
  "executive",
  "statistical",
  "events",
  "macro",
  "outlook",
  "calendar",
  "asphalt",
  "procurement",
]);
export const STAGES = Object.freeze([
  "plan",
  "acquire",
  "evidence",
  "compose",
  "quality",
  "render",
  "finalize",
]);
export const CANON_SHA256 =
  "5edb1848d3abd5b90ce7bcee2e894e764b354a6482665d8307e1f6d42a42ad41";
export class ReportError extends Error {
  constructor(code, status = 409) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export const requireThat = (ok, code, status = 409) => {
  if (!ok) throw new ReportError(code, status);
};
export function canonical(v) {
  return JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x) && !Buffer.isBuffer(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
}
export const digest = (v) =>
  createHash("sha256")
    .update(typeof v === "string" || Buffer.isBuffer(v) ? v : canonical(v))
    .digest("hex");
export function day(v) {
  requireThat(
    typeof v === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v,
    "INVALID_DATE",
    400,
  );
  return v;
}
export function command(v) {
  requireThat(
    v &&
      Object.keys(v).every((k) =>
        [
          "definitionId",
          "profileVersion",
          "period",
          "revision",
          "asOf",
          "allowPartial",
        ].includes(k),
      ),
    "INVALID_COMMAND",
    400,
  );
  requireThat(
    v.definitionId === "oil-asphalt" &&
      typeof v.profileVersion === "string" &&
      /^[a-z0-9.-]{1,80}$/.test(v.profileVersion) &&
      Number.isSafeInteger(v.revision) &&
      v.revision >= 1 &&
      v.revision <= 10000,
    "INVALID_COMMAND",
    400,
  );
  requireThat(
    v.period &&
      Object.keys(v.period).sort().join(",") === "fromDate,throughDate",
    "INVALID_PERIOD",
    400,
  );
  day(v.period.fromDate);
  day(v.period.throughDate);
  const start = new Date(v.period.fromDate + "T00:00:00Z"),
    end = new Date(v.period.throughDate + "T00:00:00Z");
  requireThat(
    start.getUTCDay() === 2 && end - start === 6 * 86400000,
    "TUESDAY_MONDAY_REQUIRED",
    400,
  );
  requireThat(
    typeof v.asOf === "string" &&
      /Z$/.test(v.asOf) &&
      Number.isFinite(Date.parse(v.asOf)) &&
      typeof v.allowPartial === "boolean",
    "INVALID_ASOF",
    400,
  );
  return structuredClone(v);
}
export function editionKey(org, c) {
  return digest([
    org,
    c.definitionId,
    c.period.fromDate,
    c.period.throughDate,
    c.revision,
  ]);
}
export function assertContext(c) {
  requireThat(
    c?.environment === "development" &&
      typeof c.organisationId === "string" &&
      c.organisationId.length > 0 &&
      typeof c.actorId === "string" &&
      c.actorId.length > 0 &&
      ["HUMAN", "SERVICE"].includes(c.actorKind) &&
      c.decisionId &&
      Date.parse(c.expiresAt) > Date.now(),
    "CURRENT_E1_CONTEXT_REQUIRED",
    403,
  );
  return c;
}
export function assertProfile(p) {
  requireThat(
    p?.canonSha256 === CANON_SHA256 &&
      p.environment === "development" &&
      p.model === "gpt-6.1-sol" &&
      p.autoRetry === false &&
      p.store === false &&
      p.rawRetentionSeconds === 0,
    "PROFILE_NOT_ADMITTED",
  );
  for (const k of [
    "budgetMicroUsd",
    "maximumInputTokens",
    "maximumOutputTokens",
    "maximumBodyBytes",
    "timeoutMs",
  ])
    requireThat(Number.isSafeInteger(p[k]) && p[k] > 0, "INVALID_PROFILE");
  requireThat(
    p.timeoutMs <= 600000 &&
      p.maximumBodyBytes <= 65536 &&
      p.maximumOutputTokens <= 16000,
    "PROFILE_LIMIT_EXCEEDED",
  );
  return p;
}
