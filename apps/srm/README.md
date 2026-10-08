# SRM Development runtime

KYS reports use a classified, shared cache in `srm_app`. A complete normalized report is reused for the same NIP and entity type across organizations until its retrieval time plus the configured TTL. Each request still writes an organization-scoped lookup, attempt (`PROVIDER` or `CACHE`) and snapshot; the browser receives masked PESEL values through the existing reveal flow.

`SRM_KYS_CACHE_TTL_HOURS` defaults to `168` (seven days). Set a whole number from `1` to `168` in the SRM Development Render runtime environment to shorten the period without a code release. Invalid values fail closed. A lower value immediately makes older entries ineligible. Expired entries are removed on subsequent KYS requests. This variable is not a browser secret.

Migration `0010_kys_shared_cache.sql` creates the shared table and retrieval-method audit column. Run the Development migration only against the registered SRM Neon project and `srm_app` database. Staging and Production remain outside this release.
