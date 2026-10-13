# E0-A-08 — rzeczywista próba trzech torów

13 października 2026. Source baseline e03454fdf484c51a251bf3c736d82769821af117. Status: równoległa aktywność i regresja potwierdzone; równoległy closeout/PHR następuje po publikacji niniejszego dowodu. Ten snapshot nie udaje wcześniejszego zakończenia publikacji.

## Współbieżna praca i tożsamości

Trzy prawdziwe zadania zarejestrowano przez pełny preflight/begin/require-begin w osobnych checkoutach i bazach. Jeden rzeczywisty hostConversationId 01a133c2-c245-77a0-bb6b-33165e2ad80c, trzy różne task-scoped conversationId. Niezależne procesy czytały własne running records i bazy w nakładających się przedziałach czasu. Nie użyto subagentów lub fikcyjnych Source IDs.

| Projekt | TaskId | Rejestracja | Baza |
| --- | --- | --- | --- |
| SG2 | SG2-E0-A-08-PARALLEL-20261013 | cmv75y3rt000090dadvhogjix | neondb |
| SRM | SRM-E0-A-08-PARALLEL-20261013 | cmv75y7l40000xonr1qrfrbva | srm_pmos |
| ARCHITECTURE | ARCHITECTURE-E0-A-08-PARALLEL-20261013 | cmv75zg4z0000m239brkkobip | architecture_pmos |

Actual intervals UTC:

- SG2: 2026-10-13T21:00:54.032Z → 2026-10-13T21:00:56.545Z; PID62945; conversationId pmos-task-v2:15ac26703ea3b22ab2a2dcc63ff811bf588a479cc2ced9ac1cd4c51ebc2d6b48; pending/lockclear.
- SRM: 2026-10-13T21:00:54.032Z → 2026-10-13T21:00:56.546Z; PID62941; conversationId pmos-task-v2:15e1773dfd4fafb05569916b80831d31215fa215e5216895ca77965f375039c7; pending/lockclear.
- ARCHITECTURE: 2026-10-13T21:00:54.031Z → 2026-10-13T21:00:56.545Z; PID62946; conversationId pmos-task-v2:04f96da50b0dc74bb854e94755dac9d7a5a1ce106d6cb1f50d6eec1882b77bb4; pending/lockclear.

Max(startedAt) < min(finishedAt): PASS. Databases/current roles independently queried; Architecture role architecture_pmos_runtime. Own slots/context/PHR clone/ports remained separate. This proves concurrent technical execution, not three humans developing features or cloud Codespaces.

## Techniczna trwałość i ponowienia

Only new Architecture laboratory databases received synthetic evidence rows; no customer/product payload or provider call. Each probe accepts exact Canon host/database/limited role and a registered Architecture task/source SHA. Both real writes CREATED, then same row ID IDEMPOTENT on replay. Source SHA e03454fdf484c51a251bf3c736d82769821af117.

- SG2: architecture_sg_lab / architecture_sg_lab_runtime, probeId 7eaa7073-67ae-4e74-a557-9b376af42f72. Replay IDEMPOTENT.
- SRM: architecture_srm_lab / architecture_srm_lab_runtime, probeId ff865830-565f-4df8-b385-1cc0f4446d5d. Replay IDEMPOTENT.

Repeated independent IAM queries and actual opposite-database connection attempts: nonadministrative flags/memberships unchanged; own reads pass; owner-marker/schemaCREATE/opposite-lab connect denied. Lab data is technical evidence, not tenant isolation proof.

## Negatywne próby i regresja

Six synthetic source-gate attempts were BLOCKED: Architecture→SG2 product, Architecture→SRM product, SG2→SRM product, reservedArchitecture Staging/Production and unregisteredprofile. They created no provider/task mutations. Earlier scratch-only changed contract digest failed both actual consumer tests and restored copy passed. Owner URI/foreignhost/wrong database/workspace/role tests remain in the existing suites.

SG2 actual typecheck and production build PASS; existing build-contract and2consumer testsPASS. Its Prisma build regenerated two tracked market-data-client outputs and untracked generated files. Initial source was clean; all own generated outputs preserved in its ignored PMOS recovery/dependency-generation/e0-a-08, and only those outputs restored/removed to the original HEAD. No unrelated work overwritten.

SRM initial full test failed the PR277 decimal-precision regression because node_modules held a copy of local srm-xray from before that source change. Existing Canon warns that a file dependency is not isolated by version alone. Reinstalled exact current lockfile with npm ci --install-links, without an upgrade: typecheck PASS; tests295, passed292, skipped3, failed0; productionbuild PASS. Three local DB-backed cases skipped without isolated test database; standard GitHub SRM CI had executed its independent Postgres tests. Next generated own next-env.d.ts was preserved in ignored recovery and restored to initially clean source. Refresh local file dependency copies after main/package source changes; do not weaken a failing regression test.

Full business E2E/login/assignment/provider-refresh/payment flows are not claimed by these checks. Product source functions and databases were not changed or deployed by E0-A. Read-only product health HTTP200: SG2 service srv-dapa3tid0e5s73f8bc5g deploydep-daqd0uh42hec7398f5vg/sourcec55c551091b3584673726bd0a78254eb091c7197; SRM service srv-db1vu6gm7kps73d0e3r0 deploydep-db77j825b2lc73equti0/sourced0a251bd4624a9ab7deb6df177338deb74f6884a. This plan performed no product deployment. Cloud Codespaces still unexecuted.

## Publikacja równoległa i odbiór

Po merge i ponowieniu pełnych bramek każdego toru trzy kanoniczne pmos:save processes zostaną uruchomione równolegle w ich osobnych PWD/config/slots/clones. Każda publikacja musi mieć własny projectKey:taskId, completed/CLOSEOUT_COMPLETE, archive/trail/context i actual remote PHR ancestry. Canonical publisher zachowuje pending/recovery na niepowodzenie i obsługuje kolizję remote bez force-push. SG2 wymaga MemorosDELIVERED; SRM/Architecture mają disabled by profile. Odbiór09 uzupełni rzeczywiste przedziały, wyniki i commits po ich wystąpieniu. Retry success nie może być wywnioskowany z braku błędu lub samego commitu.

Chroniona konfiguracja runtime Architecture zawiera wyłącznie ograniczone połączenia własnych nowych baz oraz private PMOS. Nie otrzymała business Development/Staging/Production połączeń. Uprawnienia właściciela konta dostawcy i dostęp agenta administracyjnego są szersze; sam routing/profil nie jest kryptograficzną izolacją takich administratorów. Ten dowód nie wdraża pełnej architektury E0–E4.
