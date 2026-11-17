# Exact package-pin preflight repair — owner recovery decision pending

Status: PREPARED / NOT_AUTHORIZED_FOR_MERGE_OR_RECOVERY. Date: 2026-11-16.
Task: ARCH-CLOUD-DEVELOPMENT-STANDARD-CONT-20261116. Project: ARCHITECTURE / Development.
Owner: Governance Source Layer. Host: 01a1e538-b4a8-7d43-a3ca-35cf9711e157.

## Verified state

Owner SG-DEV-STANDARD-1087-V1 accepted exact standard7947a254 and neutral pilot1088. Administrator confirmed the bounded personal package-read credential and all-external-contributors policy. Trusted-main controlled run [43918398057](https://github.com/profitia/SG-dev/actions/runs/43918398057), control80875d8f, completed SUCCESS for exact source7947a25450eb675648ca1469d07b7ff632f6bd18: real clean installation, API/persistence/revocation tests, typecheck and build. Its only controlled-proof archive14254566322 has independently checked SHA256 a01e2ff651b0a064d55a1bf0a430680d351e1dcf2b00eb33d488d8ae1d5c599a. PR1087 exact-head public checks completed SUCCESS before the normal main acceptance.

Standard main is now33c4371c0a7378cf8d1e74c7f3da602b4e869809. Post-acceptance run [43921526489](https://github.com/profitia/SG-dev/actions/runs/43921526489), controlled job133489784722, failed with TRUSTED_PACKAGE_PIN_REQUIRED before the first package-registry request. Current accepted lock entries @profitia/advisory-widget1.0.0 and @profitia/cic-procurement1.1.1 legitimately omit resolved; @profitia/cic-core1.6.0 records it. All three have immutable SHA512 integrity. The preflight incorrectly required resolved on all three. The preparation review missed this real-lock case. No missing READ grant is established by this failure.

The full apps tree4aec636e5e7d841fb0d1a5f1892a37be05d8c4e3, packages tree1979e34ce22240559e83ed09f658d1b71df8aecf, Render Blueprint blob1a8cfff6145b7ed2d9df997a89d684e059adfd50 and workflow blobee02f3eaf59a32dff7a1cb72cbf6ec17a3c95947 are identical between the successful tested candidate and current accepted main. This correction changes no app/package file, private name/version/integrity, workflow permission, credential, resource or runtime.

## Minimal correction

Exactly four governed paths: controlled-package-ci.mjs, its test, the relevant CORE Canon paragraph and this evidence. Missing optional lock resolved no longer blocks an exact version with unchanged integrity. Registry metadata is constrained to HTTPS npm.pkg.github.com, the exact approved package/version path, no foreign origin/credentials/query/fragment and, when recorded, the identical resolved URL. An explicit metadata-integrity mismatch is still rejected.

The trusted preflight also performs npm pack for that exact version with ignore-scripts into its existing isolated temporary directory. It validates returned name/version and safe filename, then independently computes the tarball SHA512 against the unchanged trusted lock. This permits missing dist.integrity only because real byte measurement remains mandatory. Captured npm output and temporary archives are not published and are removed before candidate execution. No candidate code or lifecycle script receives a package credential. No PAT fallback is introduced.

Two new regressions cover the actual two missing-resolved entries, foreign package/version/registry, changed known URL, wrong metadata integrity, protocol/query changes, actual archive-byte substitution and unsafe archive paths.

Full controller/path-coverage/shared-standard regression: **312/312 PASS**, zero failed/cancelled/skipped; the five executable/test input hashes remained unchanged during the complete run. Two focused new package-probe tests PASS. Manifest, routing, require-begin and exact four-path closure are independently checked before publication. These are preparation results, not a new job-token installation or a fabricated successful pre-merge controlled proof.

## Exact bounded recovery decision requested

The currently active preflight fails before candidate selection. It therefore cannot issue a new pre-merge controlled proof even for this repair. Blind retry, fake green status, changing branch/Environment protection, credential substitution or self-executing candidate policy are forbidden. The original owner decision does not automatically approve these new protected bytes or an exception to its pre-merge proof requirement.

A new explicit owner decision is required for the exact final SHA/diff of this correction and a **single, disclosed exception to a fresh controlled proof before merge**, restricted to this four-file controller-only repair. This is a change to the acceptance requirement for this one recovery, not a claim that the existing check passed. The alternative evidence is the independently verified successful controlled proof above for the identical full application/package source, together with unchanged workflow permissions, current exact-head public governance/Architecture/SG2+SRM adoption/dashboard/SRM integration controls and the full repair regressions. The exact-head SG2 proof-verifier job cannot succeed under the currently broken controller and must remain visibly failed rather than be rewritten or fabricated.

Only after that separate decision and every other applicable public control passes may a normal exact-head PR merge accept this correction. The existing main PR/no-force/no-bypass rules remain; no administrative bypass actor or protection change is authorized. Re-read current main, exact candidate, approved four-path closure and unchanged application/private pins immediately before merge. Unrelated application/workflow/private-pin drift stops this recovery.

Immediately after acceptance, require the real new-main job-token exact-artifact probe, clean installation, API/typecheck/build and resulting-main proof. One exception grants no success claim or further policy exception; any new failure is preserved and reconciled. Existing separately approved conditional READ to the three packages remains usable only if a real access probe establishes absence and the administrator confirms fork policy. No secret value may be read or transferred.

The already approved neutral pilot1088 and exact admission record5732d2cea362d8208babf9cde0941c007bc8a7474c5cf6cf9555bf25b3284add remain uninstalled/pending; their source/owner/expiry is unchanged. Complete their independent trusted-main acceptance, real exact-source pilot, actual refusals/resume proof, downstream references and PMOS/PHR closeout only after actual operational acceptance. This proposal authorizes no existing feature takeover, product runtime deployment, new resource/cost, Stage/Production or database restore.

A compatible rollback retains the existing exact own-change revert procedure and independently verified transitional credential. Do not reset main, overwrite parallel work, restore data or label the currently broken preflight a functional LKG. No recovery merge has yet been performed.
