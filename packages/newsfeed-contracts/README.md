# Newsfeed contracts1.0.0

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

This first slice is an operator-only Development library and CLI. Future hosted
adoption must enforce the verified host's E1 context, product/operation access and
private-data boundaries before execution. This package supplies no authentication,
membership, tenant store, subscriptions or user identity mechanism.
