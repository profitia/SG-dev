# SG2 — independent framework security and SRM compatibility

Task `SG2-E1-FRAMEWORK-SECURITY-COMPATIBILITY-20261017`, SG2 / Development.
Authority `c8a4f727d232d1a76d07e8181bbf68f6c1c41160`; incoming SRM source
`6e2879baac998972812ac7337914f6a3e5b7a93d`, [PR432](https://github.com/profitia/SG-dev/pull/432),
task `SRM-E1-FRAMEWORK-SECURITY-COMPATIBILITY-20261017`.
Status: **source candidate; exact remote validation required; no deployment**.

## Result and limits

Retain two independent framework lines. SG Runtime and dashboard update only
Next14.2.29→14.2.35 and add direct public sharp0.35.5, preserving React18.3.1,
identity SDK, all other direct dependencies and every existing private/local
Profitia lock entry. SRM's separately owned candidate uses Next16.4.1/React19.2.4
and its own sharp0.35.5 fix. Incoming source is not evidence of SRM closeout and
its task/history is referenced without copying foreign relational identifiers.

The [December advisory](https://nextjs.org/blog/security-update-2025-12-11)
provides the14.2.35 App Router DoS patch. The official
[October image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)
allows sharp>=0.35.5 as mitigation; adding the direct public package makes the
framework's native image resolution explicit and testable, without forcing an
unrelated major framework or React migration. This is a justified security
dependency, not a new paid service or business feature.

Each host has a real trusted SVG→PNG regression and verifies Next and host resolve
the same installed patched native package. Conditional ESM/CJS wrappers are not
incorrectly required to have the same JavaScript function identity. The runtime
adds that test to its existing operation suite; dashboard's existing wildcard
includes it. The existing public dashboard CI and controlled private runtime CI must
exercise their own installed dependencies independently on Linux before merge.
The CI controller/package credential boundaries and package visibility/access are
unchanged. No token was read, copied, requested or exposed by this task.

## Verification before source publication

- Own seven-path preflight, begin and require-begin PASS on clean isolated source.
- Both lockfile updates PASS; all existing private/local package records and all
  unrelated direct dependencies match the incoming source exactly. Canonical
  install-links and the three fixed private package names/versions/integrities
  are retained.
- Dashboard clean public installation, generation,304 tests (zero skipped),
  typecheck and full Next14.2.35/React18 build PASS. Its native conversion uses
  sharp0.35.5. Four actual production HTTP refusals are also checked against this
  changed build. All33 governance/workspace/controlled-policy tests PASS.
- A deliberately credential-free local clean SG Runtime installation encounters
 401 for an uncached private package. No repeated Render NPM token or GitHub PAT
  is read and no registry/access rule is weakened. This checkout's isolated
  runtime node_modules is not a verified new local installation; do not claim
  local runtime tests, typecheck or a new local runtime build passed.
- The already authorised main-only controlled CI is the runtime's clean registry
  validation authority. Exact remote runtime API/SQL/native/type/build and
  dashboard/source/SRM checks must pass on the final aggregate before merge and
  canonical closeout. Pending remote evidence is not labelled complete here.

## Remaining boundaries

The [October Server Actions advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r)
requires an App Router Server Action for its stated exposure. The current patched dashboard build and earlier local
SG Runtime manifest have zero node/edge actions; the exact controlled runtime
build must be checked again. This bounded patch is not a blanket security exemption, proof of
live artifacts, permission to introduce Server Actions under old assumptions or
assertion that all advisories are closed. SRM's framework patch has its own
profile evidence. Native image behavior in a live release still requires actual
retained artifact and runtime checks, not only a lockfile or a local probe.

No database, role/grant, secret, service configuration, private application flag,
source ownership, existing data or deployment is changed. Existing product
Development/Staging continue their own release cycles. E0/E1 remains IN_PROGRESS:
remaining named-user entrances, service/provider/job/cache/file controls, actual
Supplier Intelligence reuse and controlled releases need their own evidence.
Own SG2 PMOS/MEMOROS/PHR closes only after exact source/CI/merge is confirmed;
Staging is not reported as a Development continuity task.
