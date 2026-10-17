# SG2 — removal of unverified identity headers, 17 October 2026

Task: `SG2-E1-UNTRUSTED-HEADER-REMOVAL-20261017`. Profile SG2, target Development. Authority at start: `d0b3b45e9359be7dc93e7f68f28db8a8e004894c`.

## Finding and resulting behaviour

The legacy `resolveCognitionAuth` accepted caller-controlled `x-clerk-org-id`, `x-clerk-user-id` and `x-clerk-org-role` before checking the signed PORR session or deployment profile. Root middleware does not authenticate those headers and excludes API routes from its matcher. They were therefore not proof of an individual identity, organisation membership or role. A previous test asserted that insecure behaviour.

The shortcut is removed. A verified signed PORR session or an explicitly configured legacy server profile remains authoritative for its existing allowlisted scope. Caller headers cannot replace its identity or role, open an unrelated route, or bypass a missing session. These retained demo/development contexts are not individual HUMAN identities.

Selecting `PROFITIA_AUTH_PROVIDER=clerk`, or an unknown/empty explicit provider, closes this legacy resolver, even with a valid old demo cookie. Individual Clerk requests must use the separately accepted shared private operation host. This change does not implement that remaining all-entry adoption and does not activate Clerk on any service. Existing default `legacy_demo` behaviour and HTTP status/body contracts are retained.

## Verification before publication

- Full fail-closed preflight, own PMOS begin and require-begin: PASS.
- SG2 operation-context suite: 54 tests PASS, zero skipped; includes actual HTTP wrapper non-invocation, forged headers, signed-session precedence, wrong environment and explicit provider refusal, plus existing ordinary-role SQL/Prisma and access/audit tests.
- Existing PORR session, middleware and Polish UI regression suites: 11 tests PASS, zero skipped.
- Typecheck and full Next.js 14 / React 18 production build: PASS.
- Build-generated Prisma output was removed/restored only for known generated files; private package pins and source dependencies are unchanged.
- Exact-source controlled registry installation and required remote checks must pass before merge. Their final run identifiers and source SHA are recorded in this task's canonical PMOS/PHR closeout.

## Limits

No service configuration, database, secret, grant or live deployment changed in this source task. Current running releases remain outside this acceptance. No claim of browser OTP/session verification, all-route Clerk adoption, completed E1, Development release or Staging acceptance is made. The dated E0/E1 inventory remains a historical baseline; this evidence supersedes its unverified-header finding only for this corrected source path.
