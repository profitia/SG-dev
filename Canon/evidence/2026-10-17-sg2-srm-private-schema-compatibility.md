# SG2 — compatibility acceptance of the SRM private schema source candidate

Task `SG2-E1-SRM-PRIVATE-SCHEMA-COMPATIBILITY-20261017`, SG2 / Development.
Authority at start: `ab2f0c8bdcb2b8436c5ccdc526615711a870b797`.
Related producer/receiver task: SRM / `SRM-E1-PRIVATE-BUSINESS-SCHEMA-20261017`,
repository `profitia/SG-dev`, source `7e9def92fd367137258696aae211ac4e6554e7fd`.
Foreign PMOS relational IDs are not copied into this task.

The separate SRM candidate extracts the existing ordered migration-source and
parameterized ledger plan and adds a guarded initial private-store adapter. It
does not change the shared package, its source fingerprints, the access/module/
audit schemas, SG2 business schema, private runtime targets or existing selection
dispatcher. It does not connect to or grant access to SG2's business tables.

This SG2 task changes only this evidence document. It has its own begin,
require-begin, acceptance and PMOS/MEMOROS/PHR closeout. SRM owns its implementation,
DDL tests and own closeout. Both coordinated PRs must identify the same aggregate
candidate SHA. The trusted main-only package controller validates the exact SG2
PR/SHA with the existing limited credential boundary; the token is removed
before candidate code runs. No package visibility, access, token, controller
allowlist or dependency pin changes are authorized or introduced by this task.

Acceptance requires the current 76 SG2 operation/configuration/real API/ordinary
role tests, typecheck and Next14/React18 production build, the public contract
adoption checks and all required governance checks on that exact candidate.
The independently tested existing 11 PORR regressions remain unchanged. Exact
local/remote results, aggregate SHA, source PRs and retained evidence are recorded
in the canonical task closeout after they actually pass. A red check is not
waived by the coordinated branch layout.

No product/database/role/configuration, secret, domain, deployment or application
activation changes occur here. This verifies source compatibility; it is neither
cloud installation of SRM nor adoption of its full Supplier Intelligence module
by SG2. Browser login, all-entry coverage, actual business module reuse and
controlled Development then Staging releases remain required E1 work.
