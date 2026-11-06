# Platform Source Hub contracts1.0.0

Private, framework-neutral ESM package with public TypeScript declarations. `HubRequest` is a discriminated union of provider/family/operation criteria. `parseHubRequest` rejects version/provider/family/unknown-field mismatches. `assertHubResponse` validates the consumer wire envelope, separate family payloads, licensed provenance, current receipt linkage and bounded metadata. An HTTP200 or a raw provider object cannot satisfy this contract.

Families: News Discovery, Economic Calendar, Market Observations, Indicators, External Forecasts. Market Observations remains a future contract with no endpoint. Calendar distinguishes Actual, consensus Forecast, TEForecast, Previous, Revised, DateSpan, UTC event time and update time. Indicators distinguish zero/missing, reference period, units and update time. External Forecasts preserve horizons/vintage and never become Forecast Core predictions. News/Web kinds and ambiguous publication/modified/indexing metadata remain separate.

Every returned source record carries family/version/provider/API identity, vendor record ID if supplied, source reference/URL, retrieval/availability/asOf, licence, quality, fingerprint, retention and Source usage receipt. Unknown times are null. Only explicitly licensed private consumer distribution is implemented. Consumer context and user observations are not part of a global source payload.

The preserved NewsDiscovery0.1.0 types and version constant are exported here and re-exported by `@profitia/newsfeed-contracts` for existing consumers. No Source Hub runtime code imports private Newsfeed logic. New consumers must explicitly adopt1.0.0 and their own E1/peer/Source/licence bindings; this package does not grant access.

Additive activation capabilities (2026-11-04): TE News uses the existing News Discovery family; optional market forecasts use External Forecasts with required native `marketCategory` and optional locally filtered `symbols`. The five families and Hub1.0.0 wire version remain unchanged. Optional `coverage` reports a provider-returned subset, local counts and UNKNOWN/INCOMPLETE completeness; it never promises all upstream matches. Existing requests/responses without coverage remain valid. Brave Boolean acceptance remains EXPERIMENTAL_UNVERIFIED. No live entitlement, consumer adoption or Forecast Core equivalence is established by this contract.

## First-party transport (package 1.1.0)

`@profitia/platform-source-hub-contracts/client` exports `createFirstPartySourceHubClient` for any registered component, HUMAN session or canonical SERVICE job. Per-component Ed25519 keys authenticate transport; current E1 grants and the product's provider licence independently authorize data. No provider secrets or new adapter belongs in a consumer. Payload/response contract remains 1.0.0. See [integration](../../apps/platform-source-hub/docs/first-party-consumers.pl.md) and [active amendment](../../Canon/v1.1-platform-source-hub-universal-first-party-consumer-access.md). Legacy Newsfeed remains compatible.

## Calendar durable storage projection (package1.2.0)

The existing1.0.0 family contract adds optional economic-calendar metadata
`consumerStorage:{mode:'DURABLE_OWNER_ENTITLEMENT',basisRef,licenceVersion}`.
Only an active owner-controlled universal calendar licence may emit this
projection. Existing transient cache TTL/retentionUntil and all other families
retain their meaning. Installing migration005 defaults every row to
TRANSIENT_ONLY and changes no entitlement or quota. Durable consumers must
reject missing rights; null cache TTL is never a durable-storage permission.
The owner declaration governs licensed durable reuse without an invented
history retention period. Existing consumers remain compatible.

Proposed market-observations producer (Hub contracts1.3.0): snapshot commodity catalogue with local symbol/TE-URL selection, and dated per-symbol historical series. Shared wire remains1.0.0. Preserve vendor symbol, market classification separately from actual instrument type, time precision, quote basis, OHLC and unknown unit/currency. Canonical Market Data mapping is NOT_ADOPTED. Historical symbol transport is a separately pinned opt-in MARKET_SYMBOL proposal in SDK1.34, never a relaxation of API_PATH. See `apps/platform-source-hub/docs/te-market-observations.pl.md` for the ungranted licence, producer/consumer adoption, SQL, Source/E1 and rollout dependencies. Existing Market Forecasts remains independently licence-gated and OFF; no Calendar request is authorised by this extension.
