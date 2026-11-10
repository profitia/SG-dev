# Newsfeed contracts1.2.0

`/v1.2/observations` uses `parseSavedSearch` and `SAVED_SEARCH_CONTRACT_VERSION`.
It adds normalized literal phrases, versioned criteria, an explicit calendar
schedule and opt-in notifications. IDs for the owner, actor, application and
organisation are resolved by current E1; they are not writable input fields.

Saved runs and their metadata snapshots are immutable. The permanent index
contains permitted URLs, titles, dates and provenance, never provider bodies,
snippets or AI summaries. Statistics count distinct indexed publications with
literal title matches, overlapping phrase series, Monday-based local weeks
and explicit publication/detection dates. Provider completeness stays unknown.

Sharing provides read-only USER/ORG access to a specific observation. A
single-use invitation identifies its recipient from fresh E1 on acceptance,
without a copied user directory. Only the owner can edit, discover or revoke.
Existing private RLS and signed current-E1 proofs remain in effect.

Schedules saved without an admitted SERVICE/delegation binding report
`WAITING_AUTHORIZATION`; saving a schedule is not execution authority.
See the backend's `docs/development-v1.2.md` for activation prerequisites.

The existing `/v1` observation API and `NewsDiscovery 0.1.0` stay compatible.

Public typed observation API, server-owned persisted identity fields, optimistic updates and ACTIVE/PAUSED lifecycle. Observation requests are News Discovery search requests under Source Hub1.0.0; Calendar/Indicators/Forecasts cannot be silently stored as publication observations. The package does not authenticate or grant access.

Legacy NewsDiscovery0.1.0 types/version remain re-exported from the single producer package, `@profitia/platform-source-hub-contracts`. Existing consumers retain article/headline/publisher semantics and unsupported-filter behavior. Old import paths and the31 original connector tests remain compatible. Package major1 describes the added observation API; it does not change the preserved NewsDiscovery wire version.

# News Discovery contract 0.1.0

Architecture Platform producer contract; no SG2/SRM adoption or deployment is implied.
`NewsDiscoveryProvider` separates article discovery, headline editions and publisher
catalogues. Consumers use neutral fields (`publishedAfter`, `publisherIds`,
`editionCountry`, `eventLocation`) rather than NewsAPI parameter names.

Every provider advertises capabilities and must explicitly reject unsupported
criteria. Event location, publisher country and headline edition are separate
concepts. Null metadata means unavailable, never inferred geographic precision.
An empty successful response is distinct from an error, a blocked filter or an
exhausted plan. `totalAvailable` is a provider count, not a promise of accessible pages.

The original0.1.0 slice was an operator-only Development library and CLI. Hosted
adoption must enforce the verified host's E1 context, product/operation access and
private-data boundaries before execution. This package supplies no authentication,
membership, tenant store, subscriptions or user identity mechanism.
