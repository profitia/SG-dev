# SpendGuru Dashboard Preview - Variant Registry Canon

Document status: CANONICAL
Module: SpendGuru Dashboard Preview
Purpose class: Runtime UX Variant Registry
Canonical application: `apps/dashboard-preview`
Audience: Developers, implementation agents, reviewers, maintainers
Last updated: 2026-08-18

---

## 1. Purpose

This document defines the canonical local registry for Dashboard Preview UX variants.

Its purpose is to make multiple Dashboard experiences explicit without breaking the architectural rule that Dashboard Preview remains one application and one chart ownership surface.

The registry is a runtime composition boundary, not a Git-history naming scheme.

Mandatory distinction:

```text
UX Variant != Git Version
```

---

## 2. Canonical Rule

All Dashboard Preview experiences must be registered inside:

```text
apps/dashboard-preview
```

No separate application, cloned chart surface, or host-owned chart fork may be introduced to represent a different Dashboard experience.

If a new experience is needed, the required pattern is:

```text
new experience requirement
        ↓
register local variantId
        ↓
resolve inside apps/dashboard-preview
        ↓
render through the canonical chart ownership surface
```

---

## 3. Registered Variant IDs

The local registry currently defines exactly these canonical IDs:

### 3.1 `historical-v1`

- lifecycle: `legacy`
- runtime status: `provenance-only`
- materialized in current baseline: `no`
- current host status: standalone `provenance-only`, embedded `provenance-only`
- purpose: preserve a truthful registry entry for the recovered historical Dashboard UX lineage
- provenance source: `DASHBOARD_PREVIEW_EXISTING_UX_VARIANT_MAPPING.md`

### 3.2 `finder-embedded-v2`

- lifecycle: `active`
- runtime status: `runnable`
- materialized in current baseline: `yes`
- current host status: standalone `runnable`, embedded `runnable`
- purpose: current canonical chart-first benchmark experience and embed baseline
- current implementation surface: the existing `RawDataView` composition resolved from the locale page boundary

### 3.3 `forecast-portfolio-v3`

- lifecycle: `planned`
- runtime status: `planned`
- materialized in current baseline: `no`
- current host status: standalone `planned`, embedded `planned`
- purpose: reserve the future Forecast Portfolio UX slot without pretending the implementation already exists

---

## 4. Resolver Rules

The canonical resolver lives at the application page boundary before chart rendering begins.

Resolver rules are mandatory:

1. `variantId` is optional.
2. If `variantId` is missing, resolve to `finder-embedded-v2`.
3. If `variantId` is unknown, fall back deterministically to `finder-embedded-v2`.
4. If `variantId` is known but not runnable, do not silently impersonate another known variant.
5. A known but non-runnable variant must return a controlled non-runnable surface with truthful lifecycle and runtime status.
6. The resolver must remain independent from Forecast Core mathematics.

Current canonical behavior therefore is:

- `historical-v1` -> controlled non-runnable state
- `finder-embedded-v2` -> runnable canonical surface
- `forecast-portfolio-v3` -> controlled non-runnable state
- unknown `variantId` -> fallback to `finder-embedded-v2`

---

## 5. Stable Host Contract

The variant registry is additive to the existing Dashboard Preview host contract.

The following query parameters remain the stable integration contract for the active embedded experience:

- `embed=1`
- `seriesId`
- `range`
- `displayName`

`variantId` is an optional registry selector layered on top of that contract.

Current host-contract rules:

- embedded hosts default to `finder-embedded-v2`
- existing embed consumers do not need to send `variantId`
- switching variants must not mutate the meaning of `seriesId`, `range`, or `displayName`
- `RawDataView` remains the only materialized runtime composition until another variant is intentionally implemented

---

## 6. Standalone Experience Library

Dashboard Preview may expose a standalone-only variant switcher.

Current rule:

- standalone mode may show only runnable registered variants
- embedded mode must not show the switcher
- non-runnable variants remain registry-visible through documentation and resolver behavior, not through an interactive embedded switcher

This keeps the host contract stable while still making the registry explicit in the canonical app.

---

## 7. Relationship To Provenance Documents

The registry canon depends on, but does not replace, the provenance documents.

Authority split:

- `DASHBOARD_PREVIEW_BASELINE_PROVENANCE.md` records the canonical authored baseline establishment
- `DASHBOARD_PREVIEW_EXISTING_UX_VARIANT_MAPPING.md` records the best authored lineage mapping for pre-registry variants
- this document defines the active local runtime registry and resolver behavior inside the recovered canonical baseline

---

## 8. Explicit Non-Goals

This canon does not authorize any of the following by itself:

- implementing `forecast-portfolio-v3`
- changing Forecast Core mathematics
- duplicating chart logic outside `apps/dashboard-preview`
- creating a separate UX Variant Registry service
- migrating chart ownership into Benchmark Finder or another host application

---

## 9. Safe Next Evolution Rule

If a future Dashboard experience becomes real, the required sequence is:

```text
define truthful registry metadata
        ↓
materialize implementation inside apps/dashboard-preview
        ↓
validate standalone and embedded behavior
        ↓
update this canon and the provenance mapping if needed
```

No variant should be marked runnable before the implementation and validation both exist.