# ECR backend — exact CI admission proposal

**PROPOSED / CI_POLICY_APPROVAL_PENDING.** ARCHITECTURE / Development, task ARCHITECTURE-ECR-BACKEND-CI-ADMISSION-20261106. Existing G1 and PR907 are accepted. This separate review is required by the current trusted controller and existing shared integration runbook; it is not a new G1.

Draft PR908, branch architecture/ecr-sourcehub-live-backend-20261106, candidate 253e20369fcd26f1985fc14188fd3e7f927a8faa, base b837f93b47d15cd812242a2ab0df6e69c35b3656:44 exact source files. Independent actual metadata and Git tree reconciliation found only regular100644 files and actual ARCHITECTURE/ALIGNED routes. Trusted main returns ARCHITECTURE_PATH_REJECTED, while its public SG2 proof check reports CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA. Code and offline SQL/API tests are distinct from LIVE acceptance.

Exactly four policy proposal files: existing controller, its regression suite, existing integration runbook and this evidence. No CI workflow, credential, Environment, active canon/registry or product source is changed by this proposal. All44 reviewed source versions, statuses and modes are closed trusted-main data; candidates cannot supply a list.

| Reviewed file | Status | Mode | Git blob | Actual owner |
| --- | --- | --- | --- | --- |
| .github/workflows/economic-calendar-ci.yml | added | 100644 | 12eb6ae888b891fcb794ac537556f36678bbb828 | Architecture Platform |
| apps/economic-calendar-runtime/README.md | added | 100644 | 72ed33ccd3fa94f0907126d8c24da5f2edbd00d9 | Architecture Platform |
| apps/economic-calendar-runtime/migrations/001-read-model-and-preferences.sql | added | 100644 | 4d9690e08c47ac4ed58b273ed5c9f09ab6cb7105 | Architecture Platform |
| apps/economic-calendar-runtime/package-lock.json | added | 100644 | a7527da73893091511fe30b0e0cedfacaf6dc7fb | Architecture Platform |
| apps/economic-calendar-runtime/package.json | added | 100644 | 0eaf4e2a8a7e431a083bdd58c3873abfdc0cd7f2 | Architecture Platform |
| apps/economic-calendar-runtime/scripts/live-probe.mjs | added | 100644 | b47e1e282523b2937ac1fa1f777de420bb36ee8a | Architecture Platform |
| apps/economic-calendar-runtime/scripts/migrate.mjs | added | 100644 | 41ace4d3f2b983f543353140380426ecd4d79127 | Architecture Platform |
| apps/economic-calendar-runtime/scripts/sync.mjs | added | 100644 | f1a8160cef52003fd90c32c864011e0db478f339 | Architecture Platform |
| apps/economic-calendar-runtime/src/authorization.mjs | added | 100644 | 97555300ace3caba31ed9c7d5adc8444e3ea3f30 | Architecture Platform |
| apps/economic-calendar-runtime/src/config.mjs | added | 100644 | bc6db6c34b0fca6e08df9ca786cc44fcaa72cc59 | Architecture Platform |
| apps/economic-calendar-runtime/src/database.mjs | added | 100644 | 0f1b9a301115f0356edf21076dcd8156faab7c52 | Architecture Platform |
| apps/economic-calendar-runtime/src/main.mjs | added | 100644 | 3464c71a0c76cc0cbc0d686709978983377b221f | Architecture Platform |
| apps/economic-calendar-runtime/src/repository.mjs | added | 100644 | 693649986edd11bf3840cc1a940b09f9a67c6285 | Architecture Platform |
| apps/economic-calendar-runtime/src/server.mjs | added | 100644 | 7a06460f1d31afa81ef79b5bb0b681bf3de1fb8c | Architecture Platform |
| apps/economic-calendar-runtime/src/synchronization.mjs | added | 100644 | d51df55cf0f3381d1c215ad0ac2e6973fdc9161a | Architecture Platform |
| apps/economic-calendar-runtime/test/api.test.mjs | added | 100644 | 2366633c1e6c9fa9e48f63f82a2992d6215124fc | Architecture Platform |
| apps/economic-calendar-runtime/test/contracts.test.mjs | added | 100644 | 05a46dcb3ea41626a366f0089cce5c64a44fa6e6 | Architecture Platform |
| apps/economic-calendar-runtime/test/fixtures.mjs | added | 100644 | 4f93e9f718b20f102d50b8bab99ace96588de58b | Architecture Platform |
| apps/economic-calendar-runtime/test/persistence.test.mjs | added | 100644 | 7d510927db554f498a0dacc094eead0d69eb15f8 | Architecture Platform |
| apps/economic-calendar-runtime/tsconfig.json | added | 100644 | 42ba04cd71eb3fb517f178bd3750c98f1dbf4ff3 | Architecture Platform |
| apps/identity-runtime/package-lock.json | modified | 100644 | 49dbc0545c1436e85314815225c60d55fafb52f8 | Architecture Platform |
| apps/newsfeed-runtime/package-lock.json | modified | 100644 | 6cfbb8246d0f58bc02f12ea8cf147ba5b55ac67b | Architecture Platform |
| apps/platform-source-hub/migrations/005-calendar-storage-rights.sql | added | 100644 | facd971fa6dab54ccf1abfde63f8fe577b3fbef1 | Architecture Platform |
| apps/platform-source-hub/package-lock.json | modified | 100644 | 07c19d47e5ac09def559a6e9623fcb94caf966ee | Architecture Platform |
| apps/platform-source-hub/scripts/migrate.mjs | modified | 100644 | 005025b14a07809b97189d8b5eda667a1df6483e | Architecture Platform |
| apps/platform-source-hub/src/repository.mjs | modified | 100644 | 73fea99afdc0354e8a74d6f8742cd022d0dcd460 | Architecture Platform |
| apps/platform-source-hub/test/calendar-storage-rights.test.mjs | added | 100644 | b81b8f53506071666110bc5827c65860f7c12999 | Architecture Platform |
| packages/economic-calendar-contracts/README.md | added | 100644 | 23925c87b98618786affb733d919017a8886a69d | Architecture Platform |
| packages/economic-calendar-contracts/index.d.mts | added | 100644 | 7c9b8fd8d609c32c6632b93b9946318c84e30bbb | Architecture Platform |
| packages/economic-calendar-contracts/index.mjs | added | 100644 | 90cf9ef27606b0c7553404e74a3f09f83a2f61f0 | Architecture Platform |
| packages/economic-calendar-contracts/package.json | added | 100644 | 3c678a9df08fd947eb6adcf9618fd423bbfa5f91 | Architecture Platform |
| packages/platform-contracts/current-e1-authority/index.d.mts | modified | 100644 | ba7cb5805c35147bf35bb9329dc6e795a1e7d5f5 | Architecture Platform |
| packages/platform-contracts/current-e1-authority/index.mjs | modified | 100644 | 7cd90689ab9784d4fd850d70b9b41254c367603c | Architecture Platform |
| packages/platform-contracts/current-e1-authority/migrations/005-calendar-authority.sql | added | 100644 | 6bb3d8e4f933c865622c46ece9aa645f04c71a2f | Architecture Platform |
| packages/platform-contracts/current-e1-authority/migrations/006-calendar-receiver.sql | added | 100644 | f2da72a900788c6ff553593481fa8e8fd3e0ec3f | Architecture Platform |
| packages/platform-contracts/current-e1-authority/package-lock.json | modified | 100644 | 67fac0488840af61b5e468823800de3be977e014 | Architecture Platform |
| packages/platform-contracts/current-e1-authority/package.json | modified | 100644 | 304041670c2bf73e00db8bf9503dc1f0f1e91657 | Architecture Platform |
| packages/platform-contracts/test/calendar-current-e1.test.mjs | added | 100644 | 6a6eae1433d61c9a115a1964e8b2d8e0e08265f6 | Architecture Platform |
| packages/platform-contracts/test/fixtures/calendar-current-e1-postgres.mjs | added | 100644 | b572f81391c6e2e538cb4f2d5138447fe842ed28 | Architecture Platform |
| packages/platform-source-hub-contracts/README.md | modified | 100644 | 3edc86b198596abd871d5b8e2b345bdf8ec53aa3 | Architecture Platform |
| packages/platform-source-hub-contracts/index.d.ts | modified | 100644 | a8ff3cc62fc8013c6c153529c4ecdc2a1650dfde | Architecture Platform |
| packages/platform-source-hub-contracts/index.mjs | modified | 100644 | 5e19c2d7d56ab4a2741d8b10df7c44e46d7a35a4 | Architecture Platform |
| packages/platform-source-hub-contracts/package.json | modified | 100644 | 17dedd4bcf6911def103f9b282765898b37391cc | Architecture Platform |
| scripts/governance/platform-source-hub-foundation.test.mjs | modified | 100644 | 8517f71a2e1556b20da36ba5888824bb0ddb1605 | Governance Source Layer |

Existing credential/repository/author/head/pagination/race/checkout/routing/proof controls remain mandatory. New tests exercise complete positive admission and all44 changed/missing/duplicate/status/rename/deletion variants, wrong PR/branch/head/account, routing drift, truncation/concurrent movement and nonregular/executable modes. No generic source path is added.

After explicit separate CI-policy approval, require exact bootstrap controlled proof and all public checks before main acceptance, then exact PR908 proof and all public/resulting-main gates. Normal reviewed revert removes this admission without touching product data. No ECR deployment, new resources or administrative enrollment is authorized. Monitoring NOT_APPLICABLE for this source-only proposal.

## Actual proposal verification

156/156 existing and new controller/path-coverage regressions PASS;0failed/0skipped. Independent real PR908 metadata, complete Git diff, all44 blobs/regular modes and actual-owner routes PASS under the proposed controller. This is local proposal validation, not protected execution or policy activation. The candidate public ECR/SourceHub/producer/governance/security checks PASS; required SG2 exact controlled proof remains missing. Full manifest, profile, routing, live PMOS preflight, actual begin and require-begin PASS for the four proposal files. No deployment or resource/admin operation performed.
