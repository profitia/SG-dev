# SRM — existing report API adopts the private host under explicit configuration

Task `SRM-E1-PRIVATE-REPORT-ENTRY-20261017`, SRM / Development.
Authority at start `77ca6e0816f966c9ccb30d75409d2d57f6bd44a1`.
Status: **source candidate; not activated or deployed**.

## Result

Existing POST `/api/xray/report-data` now calls a lazy deployment-owned dispatcher.
Default/exact `legacy_demo` preserves the existing handler without initializing
a private connection. Explicit Clerk requires complete consistent configuration;
invalid/unknown/incomplete configuration returns a generic private/no-store
failure and never retries through demo or another database.

Receiver targets pin the dated prepared Development service, source/configuration
identity, exact Neon project/branch/host/database, ordinary runtime and accepted
access/module/audit/business schema digests. The dedicated profile's fixed
organisation is supplied by server configuration; the component contains no
business organisation/user ID. Membership, permission, product and module rights
still come from the accepted common store and are checked per operation through
the official Clerk adapter. A role label or client header/body cannot grant them.

The ordinary pg pool has three business connections and one independently
reserved audit connection within its four-login budget. Only server resources
are cached under one configuration/secret fingerprint; actor/session, identity
binding, membership and operation context are never cached. Changed configuration
requires restart. Strict native TLS is passed as explicit pg fields, not an SSL
object silently overwritten by connection-string options. Host/user/database and
search path are explicit; connection, statement, acquisition and whole business
transaction timeouts remain bounded. Channel binding is enabled when offered by
the server; actual transport negotiation is a later live check. See the official
[pg SSL configuration](https://node-postgres.com/features/ssl) and
[client parameters](https://node-postgres.com/apis/client). Configuration and
parser tests do not prove a real TLS handshake.

The report adapter declares its private org-scoped projection and the approved
stored corporate financial input view. A catalogue with no stored evidence has
an explicit absence version and returns the existing NOT_REQUESTED/empty result;
it does not trigger a provider call or fabricate financial values. KYS is not
reclassified as shared. Existing `projectReportData` remains the allowlisted
financial/PII field projection; an additional output version/selection/root-field
fence refuses a mismatched supplier or unexpected raw root field. It does not
replace the existing financial/PII tests or database RLS.

The fixed organisation is the default only when no query choice is supplied.
Empty/duplicate/malformed UUID context is rejected before SQL casting. A valid
foreign organisation in the dedicated profile is CONTEXT_INVALID, even if the
actor has membership there. This follows the existing shared contract; it does
not grant cross-organisation access. Named personal preference scope still uses
the existing domain-separated server HMAC with the verified application/user,
never the old cookie as that person's identity. The existing signing secret is
required for this scope; its value is never returned or recorded.

In explicit Clerk mode middleware forwards **only this adopted API** to its own
authoritative backend guard. Other protected legacy entrances remain closed by
the existing central provider discriminator until separately adopted. Login and
health retain their own public policies. Success and refusal use private/no-store
and vary on Cookie/Authorization.

## Verification before publication

- Full fail-closed own source routing/preflight, PMOS begin and require-begin PASS.
- 56 operation/configuration/native driver/real PostgreSQL/API tests PASS, zero
  skipped. The private fixture uses the same middleware, dispatcher, resource and
  output adapter as the deployed entry and the exact checked business schema.
  Real backend access is through the ordinary role with three-plus-one pools.
- Two organisations keep their distinct archive/projection values and two named
  users retain distinct preferences. Server default, malformed/duplicate choice,
  fixed-profile foreign context, forged headers, current SDK/product/module
  revocation, independent audit failure, pool exhaustion and six overlapping
  operations pass. Wrong supplier/raw root output is denied without a false
  success outcome. Empty stored knowledge is explicit and calls no provider.
- Native pg configuration after its own parser preserves strict TLS and exact
  destination/search path even under hostile inherited PGHOST/PGDATABASE/PGOPTIONS.
  Owner, legacy, SG2/dashboard roles, foreign hosts/databases, downgrade/duplicate
  SSL settings and arbitrary URI options are refused before connection.
- 475 product tests, 311 configured promotion/migration and 165 release-governance
  tests PASS, no skipped tests. Typecheck and full Next16/React19 build PASS.
  Only this build's verified generated next-env delta was restored.
- Required remote full SRM/platform/governance and the separate exact-source SG2
  compatibility checks must pass before merge. Final SHA/run/PR and canonical
  PMOS/PHR references follow their actual outcomes.

## Explicit remaining boundaries

This unit changed no secret, database/role/grant, application flag, Render/GitHub
configuration, existing connection, domain or deployment. Dated receiver pins are
not activation authority. Both private application bindings remain disabled in
the preceding verified preparation. The new private Staging binding is not
prepared and cannot borrow Development; Production has no authorization.

Browser session, complete page/middleware login flow, other report entrances,
lookup/refresh/export/KYS/helpers, jobs/cache/files, business-module reuse and
controlled Development then Staging release remain E1 work. In particular the
prepared Clerk sign-in currently redirects to `/xray`, while the current app page
is `/` and its Next configuration has no rewrite; this latent private-mode UI
issue must be resolved and tested during UI adoption before activation. It does
not affect the unchanged live demo and is not hidden by this API-only acceptance.
Passing this source unit is not full E1 or deployed product acceptance.
