import { createFirstPartySourceHubClient } from "@profitia/platform-source-hub-contracts/client";
import { assertHubResponse } from "@profitia/platform-source-hub-contracts";
import {
  digest,
  requireThat,
} from "@profitia/insights-contracts";
/** No provider HTTP exists in Insights. The projection decision is a current,
 * server-owned licence decision; full raw records are never returned to runner. */
export function createHubSources({
  configuration,
  grants,
  projectionPolicy,
  client = createFirstPartySourceHubClient(configuration),
}) {
  return {
    async admitted(q, job) {
      const g = await grants.current(
        job.organisationId,
        q.command.provider,
        q.command.family,
      );
      return !!g && Date.parse(g.expiresAt) > Date.now();
    },
    async acquire(q, job, { idempotencyKey, signal }) {
      const g = await grants.current(
        job.organisationId,
        q.command.provider,
        q.command.family,
      );
      requireThat(
        g && Date.parse(g.expiresAt) > Date.now(),
        "WAITING_AUTHORIZATION",
      );
      const t = performance.now(),
        startedAt = new Date().toISOString();
      let value = await client.acquire({
        command: q.command,
        execution: {
          kind: "SERVICE",
          organisationId: job.organisationId,
          grantId: g.grantId,
        },
        idempotencyKey,
        signal,
      });
      assertHubResponse(value, q.command);
      const projected = [],
        seen = new Set();
      let rejected = 0,
        deduplicated = 0;
      try {
        for (const i of value.items) {
          const m = i.metadata,
            p = i.payload;
          // A callback must explicitly admit each durable projection under the current
          // licence. No implicit storage right follows from a successful acquire.
          const basis = await projectionPolicy({
            job,
            metadata: m,
            provider: q.command.provider,
            family: q.command.family,
          });
          if (!basis?.allowReportFacts || !basis.basisRef) {
            rejected++;
            continue;
          }
          const when = p.publishedAt ?? null,
            observation = p.observationAt ?? null;
          if (
            (when && Date.parse(when) > Date.parse(job.command.asOf)) ||
            (observation &&
              Date.parse(observation) > Date.parse(job.command.asOf))
          ) {
            rejected++;
            continue;
          }
          if (q.command.family === "news-discovery" && projected.length >= 3) {
            rejected++;
            continue;
          }
          const id =
            "E" +
            digest([m.sourceRecordRef, m.contentFingerprint]).slice(0, 16);
          if (seen.has(id)) {
            deduplicated++;
            continue;
          }
          seen.add(id);
          const e = {
            id,
            provider: q.command.provider,
            family: q.command.family,
            publisher: p.publisher ?? q.command.provider,
            title: p.title ?? p.name ?? p.datasetId ?? p.kind ?? q.id,
            url: m.sourceUrl ?? p.url ?? null,
            publishedAt: when,
            availableAt: m.availableAt ?? null,
            retrievedAt: m.retrievedAt,
            sourceRecordRef: m.sourceRecordRef,
            sourceFingerprint: m.contentFingerprint,
            receiptRef: value.usage.receiptRef,
            licenceRef: value.provenance.licenceRef,
            projectionBasisRef: basis.basisRef,
            materialDepth: "METADATA_AND_FACTS",
            facts: {},
          };
          if (q.command.family === "news-discovery") {
            e.materialDepth = "TITLE_ONLY";
            e.title = String(e.title).slice(0, 350);
          } else if (q.command.family === "market-observations") {
            e.facts = {
              symbol: p.vendorSymbol,
              label: p.name,
              mode: p.mode,
              price: p.price === null ? null : Number(p.price),
              observationAt: p.observationAt,
              instrumentType: p.instrumentType ?? "UNKNOWN",
              quoteBasis: p.quoteBasis,
              currency: p.currency,
              unit: p.unit,
              referenceMarket:
                p.vendorSymbol === "BIT:COM"
                  ? "China / vendor reference"
                  : "Vendor reference; mapping not canonical",
              mappingStatus: p.mappingStatus,
              temporalPrecision: p.temporalPrecision,
            };
          } else if (q.command.family === "series-observations") {
            e.facts = {
              datasetId: p.datasetId,
              referencePeriod: p.referencePeriod,
              frequency: p.frequency,
              dimensions: p.dimensions,
              measures: p.measures,
              publishedAt: p.publishedAt,
              revisionStatus: p.revisionStatus,
            };
          } else if (q.command.family === "positioning-observations") {
            e.facts = {
              datasetId: p.datasetId,
              reportDate: p.reportDate,
              contractCode: p.contractCode,
              contractName: p.contractName,
              columns: p.columns,
              publicationAt: p.publicationAt,
              unitBasis: p.unitBasis,
            };
          } else if (q.command.family === "publication-calendar") {
            e.facts = {
              scheduleId: p.scheduleId,
              title: p.title,
              scheduledAt: p.scheduledAt,
              dateOnly: p.dateOnly,
              releaseStatus: p.releaseStatus,
            };
            if (!p.scheduledAt && !p.dateOnly) {
              rejected++;
              continue;
            }
          } else if (q.command.family === "indicators")
            e.facts = {
              country: p.country,
              indicator: p.indicator,
              value: p.value,
              referencePeriod: p.referencePeriod,
              unit: p.unit,
              frequency: p.frequency,
            };
          projected.push(e);
        }
        return {
          status: projected.length ? "SUCCEEDED" : "EMPTY",
          receiptRef: value.usage.receiptRef,
          costMicroUsd: 0,
          projection: projected,
          coverage: value.coverage ?? "UNKNOWN",
          usage: {
            logicalRequests: 1,
            upstreamRequests: value.usage.upstreamAttempts ?? null,
            cacheHit: value.usage.cacheHit ?? null,
            received: value.items.length,
            accepted: projected.length,
            rejected,
            deduplicated,
            providerDurationMs: null,
            startedAt,
            endedAt: new Date().toISOString(),
            durationMs: performance.now() - t,
            providerCost: "UNKNOWN_NOT_OPENAI",
          },
        };
      } finally {
        value = null;
      }
    },
  };
}
/** Read-only Market Data / Forecast adapter. Ports are the existing accepted
 * current reads, bound by the host's SERVICE E1; never fitting models here. */
export function createCanonicalReads({ marketRead, forecastRead }) {
  return {
    async read(job, plan) {
      const market = [],
        forecast = [];
      for (const seriesId of plan.marketSeries) {
        try {
          const v = await marketRead({
            seriesId,
            asOf: job.command.asOf,
            organisationId: job.organisationId,
          });
          requireThat(
            v.seriesId === seriesId &&
              v.receiptRef &&
              v.observationDate <= job.command.asOf.slice(0, 10),
            "INVALID_MARKET_READ",
          );
          market.push(v);
        } catch (e) {
          if (!["NO_DATA", "NOT_ADMITTED"].includes(e.code)) throw e;
        }
        try {
          const v = await forecastRead({
            seriesId,
            horizon: "7D",
            asOf: job.command.asOf,
            organisationId: job.organisationId,
          });
          if (!v) continue;
          requireThat(
            v.seriesId === seriesId && v.receiptRef,
            "INVALID_FORECAST_READ",
          );
          if (
            v.models?.every(
              (m) =>
                Date.parse(m.target) > Date.parse(job.command.asOf) &&
                Date.parse(m.origin) <= Date.parse(job.command.asOf),
            )
          )
            forecast.push(v);
        } catch (e) {
          if (!["NO_DATA", "NOT_ADMITTED"].includes(e.code)) throw e;
        }
      }
      return {
        market: {
          status: market.length === 2 ? "AVAILABLE" : "PARTIAL",
          series: market,
        },
        forecast: {
          status: forecast.length === 2 ? "AVAILABLE" : "NOT_AVAILABLE",
          series: forecast,
          intervals: "NOT_AVAILABLE",
          reason: forecast.length === 2 ? null : "NO_ADMITTED_CURRENT_D7",
        },
      };
    },
  };
}
