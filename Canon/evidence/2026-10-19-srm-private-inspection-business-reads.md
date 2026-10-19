# SRM — current-authorized committed Supplier reads, 2026-10-19

Status: source candidate; isolated native verification complete. No product deployment.

Task: `SRM-E1-COMMITTED-SUPPLIER-PRIVATE-READS-20261019`, profile SRM, Development target, local execution. Authority base: `profitia/SG-dev/main` at `0b342c9210db6c120245418fdd0bc793a87917b6`. This receiving task adopts the exact accepted ARCHITECTURE inspection source from PR #528 (`6260afa8771fbb427bd0b8e359557ab8f70dd9b5`); it does not change or republish that producer.

## Implemented boundary

- One existing native PostgreSQL driver, shared inspection host, current Service identity and original internal human subject. The existing organization transaction helper distinguishes a reserved write phase from an inspection, including when the physical database is named `srm_app`.
- Optional controlled application SQL007 builds on unchanged core SQL001–015 and application SQL001–006. It adds immutable installation metadata and SELECT admission over nine existing business tables, with the original command, current organization, request, NIP and corporate section predicates. No runtime ACL, activation or data transfer is performed by this SQL source.
- Request history is restricted to the original request. Financial archives and prepared documents retain their existing organization/NIP ownership and may originate from an earlier request in that organization. This does not assign one user's personal choices to another user.
- UPDATE/DELETE have explicit restrictive write predicates; INSERT retains the original write predicate. An accepted read anchor confers no write scope. KYS, personal lists and MSR mutation tables gain no read admission.
- The native domain reader uses existing SELECT-only prepared-document access and existing pure archive provenance verification. The restoring `readFinancialDocuments` path is deliberately not invoked from inspection. Missing or stale preparation remains an explicit refusal; no empty fallback or provider retry is invented.
- The adapter snapshots validated input, checks the stored command and actual application installation, and returns frozen finite JSON only after actual committed acceptance. It reuses the canonical JSON decoder's 8 MiB maximum. A larger result is refused, not truncated. Pools, clients, non-JSON values and failed transactions cannot become a successful returned result.

## Verified isolated evidence

Fresh loopback PostgreSQL clusters, actual ordinary foreground and executor logins, FORCE RLS, the actual native driver, current Clerk account-status adapter with a synthetic provider fixture, real original business writers and non-empty synthetic data:

- Native operation integration: **172 tests passed, zero failures/skips**.
- Product/business regression: **551 passed, zero failures/skips**.
- Promotion/recovery-contract regression: **311 passed, zero failures/skips**.
- TypeScript and production build: **PASS**.

Positive reads include the actual lookup, general/financial snapshot references, prepared financial documents and verified archive. Concurrent reads for two organizations return separate supplier identities without creating another phase, quota reservation or provider action. The original four Service write phases and existing HUMAN continuation still pass.

Negative evidence includes a foreign organization, unknown request, changed NIP/command, unaccepted phase, forged transaction evidence, caller mutation, dangerous/non-JSON and oversized results, current denial/account revocation/suspended membership, and improper runtime metadata privileges. Non-empty KYS history, KYS catalogue records and named personal interest exist in the fixture and remain excluded. A forged legacy organization setting does not widen the SQL scope.

With actual DML ACLs, SELECT sees its own supplier while UPDATE/DELETE affect zero rows through RLS. An INSERT into the organization table is refused by actual row-level security before a domain trigger; supplier INSERT is additionally refused by the unchanged domain write guard. Omitted physical INTENT refuses scope, omitted OUTCOME fails actual COMMIT, and an injected COMMIT transport refusal returns no captured result. No claim is made that an arbitrary COMMIT transport error proves a rollback.

Initial local runs were red: the new adapter initially selected a byte limit above the existing decoder's accepted maximum, a synthetic membership test used an invalid status, and a historical writer fingerprint correctly detected the changed transaction helper. The limit and fixture were corrected. Historical hashes are preserved and marked historical; a new exact 16-file current source record is independently checked. The final passing run supersedes those local candidates without relabeling their logs as successful.

## Release and ownership boundaries

Read-only provider verification at **2026-10-19 11:28:39 UTC** covered 18 SG-dev Render services, seven selected live deployments and 32 Neon branches across seven registered projects. The selected deployments and manual-deploy settings match the preceding accepted baseline. This is provider metadata evidence, not live adoption of SQL007 or a product user session.

No cloud SQL, role/grant, credential, directory, customer data, resource, application configuration or deployment changed in this task. Maps files, peers, behavior and mounting are unchanged. Prepared Profitia retains its empty private history; old demo data keeps its original owner. No Render package token was reread or copied.

This is a finite native-read adoption. Complete native company acquisition/cache/MSR/provider-recovery composition, remaining working Finder/SRM ingress parity, actual owner login, live least-privilege/recovery verification and controlled Development release remain **IN_PROGRESS** for full E1. Separate protected Staging review follows the accepted program; this source task does not itself perform a release. It is not a second host UI, endpoint, complete 16-port composition or business acceptance.

Continuity: own SRM PMOS and canonical PHR closeout after exact-source CI/main acceptance. The SG2 receiver has a separate task and evidence; its history is not copied into this database.
