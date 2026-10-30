# Package & Limits G1 — closed CI admission, 2026-10-30

Status: IMPLEMENTATION_PLAN_GOVERNANCE; owner: Architecture Platform.
Authority: explicit full Development implementation/CI/controlled merge mandate in host 01a18b57-efdf-79e3-a75a-9061dc5e57cb. This is an in-scope CI onboarding prerequisite, not a product release or additional owner decision.

PR814 exact source b6f1772ecc23b9efcbac6cb4e7265cfbea375c42 has eight reviewed governance/routing/test files. Existing trusted CI requires exact SG2 proof when baseline registry changes, but the generic Architecture producer admission deliberately rejects governance-only reviews. Prior KRS/ADP admissions establish the closed review/bootstrap process in [the runbook](../runbooks/controlled-package-ci-v1.md).

This change binds only PR814, its branch and eight immutable Git blob IDs in the trusted controller. All existing controls stay enforced; no generic allowlist or candidate-executed admission logic. Negative tests cover changed/missing/extra/duplicate/deleted/renamed files, another PR/branch/actor/repository/SHA, routing drift and API races. The existing actual Git checkout security tests remain required.

Before accepting this policy: own full governance preflight/begin/require-begin, controller regression and PMOS suites, exact-head trusted-main controlled validation and public CI. Then reread main and independently validate PR814 under the new policy. PMOS/PHR acceptance and real CI are recorded separately from this source proposal; no provider, schema, application, secret, deployment or LIVE claim is made here.
