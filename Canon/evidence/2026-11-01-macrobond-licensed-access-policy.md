# Macrobond licensed access — owner decision and proposed canonical adoption

Task: `ARCHITECTURE-MACROBOND-LICENSED-POLICY-20261101`. Profile **ARCHITECTURE**, workspace **SG-dev Architecture**, target **development**, execution **local**. Authority `profitia/SG-dev/main`, starting main `ebfa1a167f61dfd5d4e94249b329264943b61260`.

The user explicitly approved standing licensed Macrobond reads and requested a minimal canonical proposal and a separate Draft PR in the appropriate profile. The [amendment](../v1.0-macrobond-licensed-access-policy-amendment.md) records that business decision. It does not grant merge or change active runtime configuration. Original instruction SHA-256: `4846b6a919c1a1456b8a6333f43dbd93d1fcef4e68b18a2ce16f09218f4b1227`.

## Audit findings

- Package & Limits base §6 lists Macrobond as a possible provider metric but distinguishes HTTP/Source/E1 effects, actual paid upstream usage and commercial units. It establishes no universal per-download Macrobond price. §9 keeps technical admission independent of commercial UNMETERED.
- SG2's Macrobond adapter uses metadata caches and one authentication renewal after HTTP401; HTTP429 preserves the supplier rate-limit failure. These are technical/efficiency policies, not a purchased download allowance.
- The SG2 Finder Source adapter has bounded per-operation ordinals, response-size/time limits and explicit permitted endpoints. Live Development Source admission has its own technical capacities. None proves an incremental supplier fee; none is changed here.
- The former D0 four-call question was a local task boundary. The new owner instruction explicitly supersedes it; it is not a permanent licence rule.
- SG2 consumer task `SG2-OIL-D0-FRESH-LICENSED-20261101` fetched real metadata through the unchanged ordinary Source host. Both selected futures report last value date2026-10-30, first position `c1`, December2026 underlying contracts. Exact history acquisition is blocked because the accepted Source paths omit `/v1/series/fetchseries` and the existing Market Data login is read-only. A commercial approval does not silently expand either safeguard.

## Scope and validation

The candidate adds this evidence and one amendment, plus one ordered manifest entry after Customer Lifecycle and before BQL. Existing documents, active policies, code, SQL, roles and deployments are unchanged. Manifest activation is proposed on this branch and is effective only after a separately authorised controlled merge.

Local validation: manifest/dependency validation, routing/preflight and existing governance regression. Exact remote HEAD and CI are reported in the final task handoff after execution. PMOS/PHR use ARCHITECTURE's registered ordinary continuity role; Memoros is disabled by that profile. SG2 keeps its own PMOS/MEMOROS/PHR records.

Monitoring: **NOT_APPLICABLE** to this documentation-only change. It adds no executable runtime or telemetry destination. SG2's existing Sentry configuration is preserved; customer source and financial data are not published to Sentry, Git or continuity artifacts.
