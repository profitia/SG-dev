# PPF-1 Fast presentation corrective — live acceptance

## Decision

The corrective is accepted. Dashboard can render representative Fast Historical Verification results while the durable queue continues toward `FULL_READY`. The 4 × 3 matrix passed, correlation and UI acknowledgement evidence reached Neon, and exact resource summaries are now persisted for non-daily Current and Verification execution records.

## Source and deployment authority

- initial corrective source: `d5e0141475d91b00f48c1cff931a29c78e145913`;
- initial merge: `62883eea7dab48b388ffdce02c12e41c9b65bf47` via PR #39;
- live-found resource-attribution follow-up: `05d5d06c643bb97f137f470eb697ac195ee581b9`;
- follow-up merge: `f7201cc7c187f2d54a043dbca177cd49a7842086` via PR #41;
- Dashboard deploy `dep-daog660ae00c73cd9m6g`: live on `62883eea7dab48b388ffdce02c12e41c9b65bf47`;
- SG Runtime deploy `dep-daogje6gekts73c72ehg`: live on `f7201cc7c187f2d54a043dbca177cd49a7842086`;
- Worker deploy `dep-daogjf0473hc73a8ga6g`: live on `f7201cc7c187f2d54a043dbca177cd49a7842086`.

## Corrective outcomes

1. Interactive Dashboard verification reads request `FAST`; direct certification reads remain `FULL` by default.
2. Verification keeps its own correlation ID through progressive polling and the first ready observation.
3. Production market-data Prisma is process-singleton and identical exact-series reads coalesce.
4. Progressive polling uses bounded retry/backoff of 1 s, 2.5 s and 5 s while preserving the last truthful snapshot on a transient failure.
5. Resource attribution covers non-daily Current and Verification by exact durable-job identity when inner compute uses a technical request ID.
6. The full matrix was rerun before the capacity decision.
7. Lawful `NOT_PREPARED` is shown as preparable, not as unsupported.

## Full matrix

Series `cnprod4431` was tested for Naive, Damped Holt, ETS and ARIMA across Daily Point in Time, Monthly Average and End of Period.

- result: `12/12 PASS`;
- all Current states: `READY`;
- all Verification states: `READY` or `FAST_READY`;
- distinct Current and Verification correlation IDs: `12/12`;
- Current and Verification UI telemetry acknowledgements: `24/24` recorded;
- Current prepared reads: 48–1,040 ms, average 298.5 ms;
- Verification prepared reads: 302–2,431 ms, average 1,709.83 ms;
- progressive snapshots: 377–3,331 ms, average 2,235.58 ms.

The two relevant progressive cases were ARIMA Daily and ARIMA End of Period. Both rendered at `FAST_READY` while their durable jobs remained active for full-history completion. The browser showed the Fast Verification explanation and metrics instead of blocking on `FULL_READY`.

## Live telemetry corrective found by the test

The first fresh non-daily proof showed successful compute but no resource summary. The cause was deterministic: the inner Current/Verification execution minted a technical request ID, while attribution filtered only by the user correlation ID.

The correction keeps correlation matching and adds a bounded exact durable-job identity fallback inside the measured worker slice. It does not broaden compute ownership or introduce a second execution path.

After deployment, fresh series `wocaes0293`, Naive, Monthly Average proved:

- Current ready at `2026-09-21T10:45:02.535Z`;
- Verification ready at `2026-09-21T10:45:59.580Z`;
- Current execution `0061d3c7-e5ab-41cc-9bcc-e1847e27bc36` has a persisted resource summary;
- Verification execution `dca4a2cf-527e-4f3d-a43b-c9b84eea347d` has a persisted resource summary;
- Current measured wall time 7.23 s, Python CPU 4.36 s, Node sampled peak RSS 187.5 MB;
- final Verification slice wall time 13.70 s, Python CPU 7.09 s, Node sampled peak RSS 222.3 MB.

Neon rows, Render logs and the public API timeline agree on the exact identity and timestamps.

## Capacity decision

During the fresh non-daily run the Worker reached 0.99–1.00 of its 1 CPU limit. Memory peaked around 332 MB against a 2 GB limit. The workload is CPU-bound, not memory-bound.

Decision:

- do not increase RAM;
- do not add concurrency on the current 1 CPU instance;
- if materially faster background `FULL_READY` is required, run a separate reversible experiment with a larger Worker CPU allocation before increasing parallelism.

This capacity decision does not block the user-facing goal because Fast Verification is already rendered before full history completes.

## Validation

- Dashboard targeted tests: 83/83 PASS;
- Dashboard full tests, typecheck and production build: PASS;
- SG Runtime targeted tests before the live finding: 28/28 PASS;
- SG Runtime targeted tests after the live finding: 29/29 PASS;
- SG Runtime typecheck and production build: PASS;
- `git diff --check`: PASS;
- public Dashboard and SG Runtime smoke tests: HTTP 200;
- 5xx requests across Dashboard, SG Runtime and Worker evidence window: 0;
- Neon action traces and execution-ledger resource summaries: verified read-only.

The full local SG Runtime wildcard suite still contains the known environment-only failure when its database test cannot reach local PostgreSQL on `127.0.0.1:55421`; database-backed behavior was independently verified against Neon and live runtime.

## Non-blocking finding

`FORECAST_REQUEST_DIAGNOSTICS` messages with `responseStatus = 200` are currently emitted at Render error level. They are not runtime failures, but they add false-positive noise to error searches and should be normalized in a separate small observability task.
