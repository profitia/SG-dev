# Oil report CI — complete consumer compatibility closure

Status: PROPOSED_NOT_ACTIVE / EXACT_OWNER_DECISION_REQUIRED
Owner: Architecture Platform / governance CI
Environment: Development source validation only
Source candidate: `470410f9cf8bc36ed2ea1f689201ca75e8b0a544`
Source tree: `1dc4155123ee3004e4b0b21a093edfb078653a26`
Authority baseline: `55f3cdfb224157f724f3912080530840b6be282e`
Existing feature PR: #923 (`feat/oil-autonomous-runner-20261109`)

The94-file source was exercised by actual trusted-main42697363840. It failed
with1353/1361 SG2 tests and genuine SDK acceptance gaps in SRM, Newsfeed and
Identity, plus Source Hub's legacy Stage2A path guard. No failed result is PASS.
The new candidate closes those gaps rather than suppressing tests.

The immutable94-file approval and PR928/#930 records are retained. This proposal
pins108 exact path/status/mode/blob/project/owner/surface records: the original94
paths plus14 necessary consumer/test paths. It changes no generic candidate
namespace, package/private registry rule, proof verifier, workflow permission,
branch protection, deployment trigger or credential handling. Every rejected
path, duplicate, rename, unexpected mode/blob or different PR identity still
fails closed. The predecessor94-file set is explicitly refused for this source.

Prepared source evidence (not a replacement for normal exact-source CI):

- Full local producer:1934/1935; all real synthetic PostgreSQL E1/report tests
  passed. The sole remaining historical FRESH digest was corrected and its
  targeted test passes. No aggregate1935/1935 exact-source claim is made.
- Newsfeed:6/6, including changed-source/history/activation negatives.
- Source Hub routing:5/5; canonical complete-checkout verifier checks bytes,
  modes and all owner bindings, and rejects tampering or extra files.
- SRM affected tests55/55; full SRM later exposed two workflow history assertions,
  corrected and verified by7/7 workflow tests.
- Calendar fixture3/3 after graceful teardown; no runtime authority change.
- The isolated producer uses SCRAM like CI. Test-only roles share the accepted
  fixture setup lock and synthetic password, avoiding concurrent passwordless
  identity-role creation. No real role or credential is changed.

CI proposal consists of exactly four files: controller, controller regression,
this new evidence record, and an appended runbook section. Earlier evidence is
unchanged. Ordinary complete CI and exact trusted-main proof remain mandatory.
An independent required reviewer is not replaced by the owner decision.

Excluded: feature merge before final SOURCE GO, SQL installation, role/grant
activation, recovery mutation, Render configuration/deployment, paid calls,
new budgets, recurring schedules and client publication. No waiver is proposed.
