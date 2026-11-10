# Economic Calendar contracts 1.1.0

ECR business/read contract; independent of provider transport. Acquisition uses
the accepted SourceHub client. `canonicalEventId` permanently identifies one
provider release key; changed keys never rebind favourites. Reference labels,
provider update time, unknown publication time and ECR observation time differ.
`Previous` is retained as `previousAfterRevision`, `Revised` as
`previousBeforeRevision`; neither consensus nor vendor forecasts are actuals.

Only an explicit SourceHub `DURABLE_OWNER_ENTITLEMENT` storage projection permits
durable content ingestion. Zero cache retention never means unlimited rights.
This contract imposes no business retention period. Existing provider and E1
admission remain mandatory. A snapshot does not establish historical vintages.

Favourite IDs and saved filters are separate. Preferences contain no supplied
user or organisation identity. Watched text topics are explicitly local literal
matching, not a native Trading Economics category. HTTP page size and private
document size bounds protect transport; neither limits stored historical dates.

Schedule adoption1.3.0 is exact-recipient and publication-calendar only.
Publication definitions and actual releases are separate; an unresolved next
schedule remains a definition observation. EIA releases require a supplied
reference period. Missing actual/previous/forecast remain null. Local storage
policy and SourceHub recipient rights must agree on the licence and owner
basis. There is no direct provider adapter, inferred numeric history or
cross-provider identity.
