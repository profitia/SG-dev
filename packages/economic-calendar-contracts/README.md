# Economic Calendar contracts 1.0.0

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
