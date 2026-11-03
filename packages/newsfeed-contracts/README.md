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
