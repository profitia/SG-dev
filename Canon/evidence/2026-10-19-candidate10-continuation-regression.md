# E1 — strict continuation audit version regression

Task ARCHITECTURE-E1-CANDIDATE10-REGRESSION-20261019, ARCHITECTURE Development.
Producer source 7b8bb2b88bb64c3b376312197251f2f120782e0c; authority profitia/SG-dev main.

The existing real PostgreSQL continuation fixture pins the exact current audit
implementation. Supplier delegation advances that implementation from candidate.9
to candidate.10. This separately registered correction changes only that exact
expected marker. It preserves the assertion, audit correlation, transactional
effects, access, idempotency and business checks. The earlier full run and its
failure remain recorded; they are not a passing validation.

Full combined producer/laboratory validation passes: 818 tests, zero failures
and zero skips on a fresh isolated ordinary-role PostgreSQL fixture; the own
cluster was stopped. The strict audit assertion remains in place.
Consumer compatibility has separate SG2 and SRM identities. This correction
changes no runtime behavior, governance policy, cloud data, configuration or
deployment. Full E0/E1 remains IN_PROGRESS.
