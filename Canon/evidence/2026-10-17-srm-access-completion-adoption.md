# SRM — explicit access candidate adoption, 2026-10-17

Status: LOCAL_VALIDATION_PASS; coordinated publication and deployment are separate gates.

Task `SRM-E1-ACCESS-COMPLETION-ADOPTION-20261017`, SRM, Development. Producer: ARCHITECTURE task `ARCHITECTURE-E1-ACCESS-COMPLETION-20261017`, repository `profitia/SG-dev`, PR #413, source `3cf75e99389fc7b888e85dce8bf28f8c85723314`. Accepted fingerprints are recorded in `apps/srm/operation-integration.json`. Separate SG2 adoption is not inferred from this record.

## Accepted implementation

The real native-pg host now requires the supplier_report module and accepted SQL002/SQL003 installation. Candidate data policies bind the module instead of a hardcoded host name while retaining the restrictive fence against legacy permissive policies. Existing shared financial knowledge remains a read projection for this human-report path; accidental metadata UPDATE privilege does not grant a shared writer. This is a candidate for the new private store, not a reclassification or migration of deployed sources.

The same common writer persists matching module evidence in INTENT and transactional OUTCOME. The real report restores source documents through the existing business code and the same accepted transaction. Membership absence is an access denial (403); configuration and writer failures remain unavailable (503). Module expiry after a write rolls back and preserves correlated FAILURE evidence. Native pg's actual PT403 transport and pool/deadline recovery are tested.

The previous local Clerk configuration validator has been removed. Both hosts use the accepted shared parser. SRM selects explicit mode through `PROFITIA_AUTH_PROVIDER`; no such mode is activated by this task. Public output contains neither backend credentials nor database connections. Existing official SDK and UI, Next16 and React19 remain unchanged. Development identity cannot be relabelled as Staging; `APP_ENV` cannot replace `TARGET_ENVIRONMENT`.

## Local evidence

- 32 actual report API/SQL/pg integration tests: PASS, zero skips.
- Eight shared-configuration, actual official SDK and React19 SSR tests: PASS, zero skips.
- Ordinary role with four-connection budget and independent two-connection audit pool; no external paid provider or live Clerk request.
- Wrong identity headers, revoked session/product/module, missing membership, missing module config, foreign organisation, legacy-only and valid-base-only scopes, shared-write ceiling, timeout, late-lease disposal, module expiry and transactional rollback are tested.
- Full Next build and typecheck: PASS. Only the build-generated `next-env.d.ts` change was restored.
- All pre-existing locked dependencies except the explicitly adopted local platform package are unchanged. Remote CI and controlled exact-source SG2 proof remain required before coordinated publication.

## Limits

No live route activation, remote migration, role grant, credential change, account bootstrap or deployment occurred. SDK-interface responses are synthetic and do not prove a real user session or browser flow. Current Development and Staging releases remain unchanged. Full protection of remaining entrances, jobs/cache/files, complete Supplier Intelligence reuse, private-data migration and Development/Staging acceptance remain IN_PROGRESS.
