// Report-side arithmetic only. No transport, provider credentials or Forecast fit.
import { createHash } from "node:crypto";
import { assertCommodityResponse } from "../../../packages/platform-source-hub-contracts/commodities-v1.mjs";

const fail = (code) => {
  throw Object.assign(new Error(code), { code });
};
const requireThat = (ok, code) => {
  if (!ok) fail(code);
};
export const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const day = (value) => {
  requireThat(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
    "EXACT_DATE_REQUIRED",
  );
  const d = new Date(value + "T00:00:00Z");
  requireThat(
    Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value,
    "INVALID_DATE",
  );
  return d.getTime();
};
const number = (value) => {
  requireThat(
    (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)),
    "MISSING_NUMERIC_OBSERVATION",
  );
  const n = Number(value);
  requireThat(Number.isFinite(n), "INVALID_NUMBER");
  return n;
};
const contracts = (value) => {
  const n = number(value);
  requireThat(Number.isSafeInteger(n) && n >= 0, "INVALID_CONTRACT_COUNT");
  return n;
};
const recordBefore = (item, asOf) => {
  const a = Date.parse(asOf),
    m = item.metadata;
  requireThat(
    Number.isFinite(a) &&
      Number.isFinite(Date.parse(m.retrievedAt)) &&
      Date.parse(m.retrievedAt) <= a,
    "RETRIEVAL_AFTER_AS_OF",
  );
  requireThat(
    m.availableAt === null ||
      (Number.isFinite(Date.parse(m.availableAt)) &&
        Date.parse(m.availableAt) <= a),
    "AVAILABILITY_AFTER_AS_OF",
  );
  return {
    sourceRecordRef: m.sourceRecordRef,
    contentFingerprint: m.contentFingerprint,
    receiptRef: m.usageReceiptRef,
    licenceRef: m.licenceRef,
    sourceUrl: m.sourceUrl,
    retrievedAt: m.retrievedAt,
    availableAt: m.availableAt,
    providerPublicationAt: "UNKNOWN",
  };
};
const localDate = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

/** Validate the real Hub envelope before interpreting any values. */
export function checkedHubResponse(response, command, asOf) {
  assertCommodityResponse(response, command);
  requireThat(
    Date.parse(response.provenance.retrievedAt) <= Date.parse(asOf),
    "ENVELOPE_AFTER_AS_OF",
  );
  response.items.forEach((item) => recordBefore(item, asOf));
  return response;
}

/** The selected series and unit are resolved from admitted metadata/observations,
 * never from a business inventory ID or a guessed API selector. */
export function eiaWeeklyPair(
  items,
  { datasetId, dimensions, unit, asOf, field = "value" },
) {
  requireThat(
    datasetId &&
      dimensions &&
      Object.keys(dimensions).length &&
      typeof unit === "string" &&
      unit.length,
    "EXACT_SERIES_SELECTION_REQUIRED",
  );
  const rows = new Map();
  let discarded = 0,
    deduplicated = 0;
  for (const item of items) {
    const p = item.payload;
    if (
      item.metadata.providerId !== "eia" ||
      p.datasetId !== datasetId ||
      p.frequency !== "weekly" ||
      Object.entries(dimensions).some(
        ([key, value]) => p.dimensions[key] !== value,
      )
    ) {
      discarded++;
      continue;
    }
    const lineage = recordBefore(item, asOf),
      measure = p.measures.find((m) => m.field === field);
    requireThat(measure?.unit === unit, "NONCOMPARABLE_UNITS");
    const timestamp = day(p.referencePeriod),
      value = number(measure.value);
    requireThat(
      p.referencePeriod <= localDate(asOf),
      "OBSERVATION_AFTER_AS_OF",
    );
    if (p.publishedAt !== null)
      requireThat(
        Date.parse(p.publishedAt) <= Date.parse(asOf),
        "PUBLICATION_AFTER_AS_OF",
      );
    const old = rows.get(timestamp);
    const identity = digest({
      datasetId,
      dimensions: p.dimensions,
      field,
      unit,
      value,
    });
    if (old) {
      requireThat(old.identity === identity, "CONFLICTING_REVISION");
      deduplicated++;
      continue;
    }
    rows.set(timestamp, {
      period: p.referencePeriod,
      value,
      unit,
      dimensions: p.dimensions,
      identity,
      lineage,
      publicationAt: p.publishedAt ?? "UNKNOWN",
      revisionStatus: p.revisionStatus,
    });
  }
  const ordered = [...rows].sort((a, b) => b[0] - a[0]).map((r) => r[1]);
  requireThat(ordered.length, "NO_SELECTED_OBSERVATIONS");
  const [latest, previous] = ordered;
  const comparable =
    !!previous &&
    day(latest.period) - day(previous.period) === 7 * 86400000 &&
    digest(latest.dimensions) === digest(previous.dimensions);
  return {
    kind: "EIA_WEEKLY_OBSERVATION",
    datasetId,
    latest,
    previous: previous ?? null,
    change: comparable ? latest.value - previous.value : "UNKNOWN",
    changeUnit: unit,
    changeReason: comparable
      ? "IDENTICAL_SERIES_CONSECUTIVE_WEEK"
      : "NO_COMPARABLE_CONSECUTIVE_WEEK",
    records: {
      received: items.length,
      selectedUnique: rows.size,
      discarded,
      deduplicated,
    },
  };
}

/** Disaggregated futures-only Managed Money and Open Interest, never physical demand. */
export function cftcWtiPair(
  items,
  { asOf, contractCode, contractName, datasetId = "72hh-3qpy" },
) {
  requireThat(
    datasetId === "72hh-3qpy" &&
      typeof contractCode === "string" &&
      contractCode.length &&
      contractName === "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE",
    "EXACT_WTI_FUTURES_ONLY_SELECTION_REQUIRED",
  );
  const rows = new Map();
  let discarded = 0,
    deduplicated = 0;
  for (const item of items) {
    const p = item.payload;
    if (
      item.metadata.providerId !== "cftc" ||
      p.datasetId !== datasetId ||
      p.contractCode !== contractCode ||
      p.contractName !== contractName
    ) {
      discarded++;
      continue;
    }
    const lineage = recordBefore(item, asOf),
      date = day(p.reportDate),
      c = p.columns;
    requireThat(p.reportDate <= localDate(asOf), "POSITIONS_AFTER_AS_OF");
    if (p.publicationAt !== null)
      requireThat(
        Number.isFinite(Date.parse(p.publicationAt)) &&
          Date.parse(p.publicationAt) <= Date.parse(asOf),
        "PUBLICATION_AFTER_AS_OF",
      );
    const long = contracts(c.m_money_positions_long_all),
      short = contracts(c.m_money_positions_short_all),
      openInterest = contracts(c.open_interest_all);
    const identity = digest({
      long,
      short,
      openInterest,
      datasetId,
      contractCode,
      contractName,
    });
    const old = rows.get(date);
    if (old) {
      requireThat(old.identity === identity, "CONFLICTING_POSITION_RECORD");
      deduplicated++;
      continue;
    }
    rows.set(date, {
      reportDate: p.reportDate,
      long,
      short,
      net: long - short,
      openInterest,
      unit: "contracts",
      identity,
      lineage,
      publicationAt: p.publicationAt ?? "UNKNOWN",
      reportVariant: "DISAGGREGATED_FUTURES_ONLY",
    });
  }
  const ordered = [...rows].sort((a, b) => b[0] - a[0]).map((r) => r[1]);
  requireThat(ordered.length, "NO_SELECTED_POSITIONING");
  const [latest, previous] = ordered;
  const comparable =
    !!previous &&
    day(latest.reportDate) - day(previous.reportDate) === 7 * 86400000;
  return {
    kind: "FUTURES_POSITIONING_NOT_PHYSICAL_DEMAND",
    datasetId,
    contractCode,
    contractName,
    latest,
    previous: previous ?? null,
    netChange: comparable ? latest.net - previous.net : "UNKNOWN",
    openInterestChange: comparable
      ? latest.openInterest - previous.openInterest
      : "UNKNOWN",
    records: {
      received: items.length,
      selectedUnique: rows.size,
      discarded,
      deduplicated,
    },
  };
}

/** A recurrence is not an actual release date, and is never expanded locally. */
export function confirmedOilCalendar(items, { asOf, fromDate, throughDate }) {
  day(fromDate);
  day(throughDate);
  requireThat(fromDate <= throughDate, "INVALID_CALENDAR_WINDOW");
  const accepted = [],
    excluded = [];
  const seen = new Map();
  for (const item of items) {
    const p = item.payload;
    const lineage = recordBefore(item, asOf);
    requireThat(
      item.metadata.providerId === "commodities-sh" &&
        p.kind === "PUBLICATION_SCHEDULE",
      "PUBLICATION_CALENDAR_REQUIRED",
    );
    const reason =
      !/petroleum|crude|\boil\b|\bcot\b|commitments of traders|\bcftc\b|\bsteo\b/i.test(
        p.title,
      )
        ? "NOT_OIL_RELEVANT"
        : !p.scheduledAt && !p.dateOnly
          ? "RECURRENCE_WITHOUT_CONFIRMED_DATE"
          : null;
    if (reason) {
      excluded.push({ scheduleId: p.scheduleId, reason });
      continue;
    }
    if (p.scheduledAt)
      requireThat(
        Number.isFinite(Date.parse(p.scheduledAt)),
        "INVALID_SCHEDULE_DATE",
      );
    const date = p.scheduledAt ? localDate(p.scheduledAt) : p.dateOnly;
    day(date);
    if (
      date < fromDate ||
      date > throughDate ||
      (p.scheduledAt && Date.parse(p.scheduledAt) <= Date.parse(asOf))
    ) {
      excluded.push({
        scheduleId: p.scheduleId,
        reason: "OUTSIDE_FUTURE_WINDOW",
      });
      continue;
    }
    const key = p.scheduleId + ":" + date,
      identity = digest({ title: p.title, date, scheduledAt: p.scheduledAt });
    if (seen.has(key)) {
      requireThat(seen.get(key) === identity, "CONFLICTING_CALENDAR_DATE");
      continue;
    }
    seen.set(key, identity);
    accepted.push({
      scheduleId: p.scheduleId,
      title: p.title,
      date,
      scheduledAt: p.scheduledAt ?? "UNKNOWN",
      timeBasis: p.scheduledAt
        ? "PROVIDER_TIMESTAMP_CONVERT_TO_EUROPE_WARSAW"
        : "CONFIRMED_DATE_ONLY_TIME_UNKNOWN",
      status: "PROVIDER_SCHEDULE_NOT_RELEASE_RESULT",
      lineage,
    });
  }
  return {
    events: accepted.sort((a, b) => a.date.localeCompare(b.date)),
    excluded,
    status: accepted.length
      ? "CONFIRMED_DATED_SUBSET"
      : "NO_CONFIRMED_OIL_RELEASE_DATES",
  };
}

import {
  digest as bundleDigest,
  CANON_SHA256,
  requireThat as ensure,
} from "../../../packages/insights-contracts/index.mjs";
import { windows, localParts } from "./calendar.mjs";
/** Persist only allowlisted report facts/metadata after the licence projection
 * callback; raw/native fields and complete provider payloads never enter storage. */
export function buildEvidence(job, acquisitions, canonical) {
  const asOf = job.asOf ?? job.command.asOf,
    evidence = [],
    seen = new Set(),
    coverage = [];
  for (const a of acquisitions) {
    coverage.push({
      queryId: a.queryId,
      status: a.status,
      receiptRef: a.receiptRef ?? null,
      coverage: a.coverage ?? "UNKNOWN",
      usage: a.usage ?? null,
    });
    for (const item of a.projection ?? []) {
      const id = item.id ?? "E" + bundleDigest(item).slice(0, 16);
      if (seen.has(id)) continue;
      ensure(
        item.availableAt === null ||
          (Number.isFinite(Date.parse(item.availableAt)) &&
            Date.parse(item.availableAt) <= Date.parse(asOf)),
        "LOOKAHEAD_EVIDENCE",
      );
      ensure(
        item.publishedAt === null ||
          (Number.isFinite(Date.parse(item.publishedAt)) &&
            Date.parse(item.publishedAt) <= Date.parse(asOf)),
        "LOOKAHEAD_PUBLICATION",
      );
      ensure(
        item.receiptRef && item.licenceRef && item.projectionBasisRef,
        "LICENSED_PROJECTION_REQUIRED",
      );
      ensure(
        !Object.hasOwn(item, "native") && !Object.hasOwn(item, "raw"),
        "RAW_RETENTION_FORBIDDEN",
      );
      evidence.push({ ...item, id });
      seen.add(id);
    }
  }
  const changes = marketChanges(
    evidence
      .filter((e) => e.family === "market-observations")
      .map((e) => ({ ...e.facts, mode: String(e.facts.mode).toLowerCase() })),
  );
  for (const e of evidence.filter((e) => e.family === "market-observations")) {
    const calculated = changes.find((c) => c.symbol === e.facts.symbol);
    if (calculated) e.facts.weeklyChange = calculated.weeklyChange;
  }
  const latestLocal = localParts(asOf).date;

  const rehydrate = (e) => ({
    metadata: {
      providerId: e.provider,
      sourceRecordRef: e.sourceRecordRef,
      contentFingerprint: e.sourceFingerprint,
      usageReceiptRef: e.receiptRef,
      licenceRef: e.licenceRef,
      sourceUrl: e.url,
      retrievedAt: e.retrievedAt,
      availableAt: e.availableAt ?? null,
    },
    payload: e.facts,
  });
  const groups = [
    [
      "CI_STOCKS",
      "petroleum/stoc/wstk",
      [
        ["CI01", "WCESTUS1", "MBBL"],
        ["CI02", "WDISTUS1", "MBBL"],
      ],
    ],
    [
      "CI_REFINERY",
      "petroleum/pnp/wiup",
      [
        ["CI03", "WPULEUS3", "%"],
        ["CI04", "WCRRIUS2", "MBBL/D"],
      ],
    ],
    [
      "CI_SUPPLIED",
      "petroleum/cons/wpsup",
      [
        ["CI05", "WGFUPUS2", "MBBL/D"],
        ["CI06", "WDIUPUS2", "MBBL/D"],
      ],
    ],
  ];
  for (const [id, path, series] of groups) {
    const originals = evidence.filter(
      (e) => e.provider === "eia" && e.facts.datasetId === path,
    );
    if (!originals.length) continue;
    const rows = [];
    for (const [key, code, unit] of series) {
      try {
        const pair = eiaWeeklyPair(originals.map(rehydrate), {
          datasetId: path,
          dimensions: { series: code, duoarea: "NUS" },
          unit,
          asOf,
        });
        if (typeof pair.change === "number")
          rows.push({
            id: key,
            value: pair.latest.value,
            unit,
            weeklyChange: pair.change,
            period: pair.latest.period,
            previousPeriod: pair.previous.period,
            verification: pair.changeReason,
          });
      } catch (e) {
        if (e.code !== "NO_SELECTED_OBSERVATIONS") throw e;
      }
    }
    if (rows.length)
      evidence.push({
        ...originals[0],
        id,
        title: "EIA: porównywalne odczyty tygodniowe",
        facts: { rows },
        materialDepth: "DETERMINISTIC_DERIVED_FACTS",
      });
  }
  const positions = evidence.filter((e) => e.provider === "cftc");
  if (positions.length) {
    try {
      const pair = cftcWtiPair(positions.map(rehydrate), {
        asOf,
        contractCode: "067651",
        contractName: "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE",
      });
      if (typeof pair.netChange === "number")
        evidence.push({
          ...positions[0],
          id: "CI_POSITION",
          title: "CFTC: pozycjonowanie futures-only WTI",
          facts: {
            rows: [
              {
                positionDate: pair.latest.reportDate,
                previousPositionDate: pair.previous.reportDate,
                managedMoneyNet: pair.latest.net,
                netChange: pair.netChange,
                openInterest: pair.latest.openInterest,
                openInterestChange: pair.openInterestChange,
                publicationAt: pair.latest.publicationAt,
              },
            ],
          },
        });
    } catch (e) {
      if (e.code !== "NO_SELECTED_POSITIONING") throw e;
    }
  }
  const forecasts = canonical?.forecast ?? {
    status: "NOT_AVAILABLE",
    series: [],
    reason: "NO_ADMITTED_CURRENT_D7",
  };
  for (const s of forecasts.series ?? []) {
    ensure(["cl_c1_cl", "b_c1_cl"].includes(s.seriesId), "UNKNOWN_BENCHMARK");
    for (const m of s.models ?? []) {
      ensure(
        Date.parse(m.origin) <= Date.parse(asOf) &&
          Date.parse(m.target) > Date.parse(asOf),
        "HISTORICAL_FORECAST_NOT_CURRENT",
      );
      ensure(
        m.intervals === undefined ||
          m.intervals === "NOT_AVAILABLE" ||
          m.intervalApprovalRef,
        "UNAPPROVED_INTERVAL",
      );
    }
  }
  const b = {
    schemaVersion: "ReportEvidenceBundle/OilAsphalt/0.5",
    runnerVersion: "1.0.0",
    profileId: job.profile.id,
    canonSha256: CANON_SHA256,
    asOf,
    period: job.command.period,
    windows: windows(job.command.period),
    admissionRef: job.authorityRef,
    rawRetentionSeconds: 0,
    evidence,
    coverage,
    market: canonical?.market ?? { status: "NOT_AVAILABLE", series: [] },
    forecast: forecasts,
    pilotDeviations: [
      "TE Economic Calendar excluded by owner; only verified available event dates or monitoring signals.",
      "TE Market Forecasts disabled.",
      "Internal edition requires Human Review; no customer publication.",
    ],
    missing: [
      "TE_CALENDAR_EXCLUDED",
      "TE_MARKET_FORECASTS_DISABLED",
      ...(evidence.length ? [] : ["SOURCE_EVIDENCE_UNAVAILABLE"]),
      ...(forecasts.series?.length ? [] : ["CURRENT_D7_NOT_AVAILABLE"]),
    ],
    status: "PARTIAL_READY",
  };
  b.fingerprint = bundleDigest(b);
  return b;
}
export function marketChanges(items) {
  const output = [];
  for (const symbol of ["CL1:COM", "CO1:COM", "BIT:COM"]) {
    const rows = items
      .filter(
        (x) =>
          x.symbol === symbol &&
          x.mode === "historical" &&
          Number.isFinite(x.price),
      )
      .sort((a, b) => b.observationAt.localeCompare(a.observationAt));
    if (!rows.length) continue;
    const last = rows[0],
      old = rows.find(
        (x) =>
          Date.parse(last.observationAt) - Date.parse(x.observationAt) ===
          7 * 86400000,
      );
    const same =
      old &&
      ["symbol", "currency", "unit", "instrumentType", "quoteBasis"].every(
        (k) =>
          typeof last[k] === "string" &&
          last[k] !== "UNKNOWN" &&
          last[k] === old[k],
      );
    output.push({
      ...last,
      weeklyChange:
        same && old.price !== 0
          ? {
              from: old.observationAt,
              to: last.observationAt,
              percent: (last.price / old.price - 1) * 100,
            }
          : null,
    });
  }
  return output;
}
