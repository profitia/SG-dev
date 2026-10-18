# Verification source proof scope — 18 October 2026

Status: tested corrective source candidate; no cloud installation, activation or product release.

Task `SG2-E1-VERIFICATION-SOURCE-PROOF-SCOPE-20261018`, SG2, workspace SG-dev, target Development, execution local. This is a separate correction within accepted E0/E1. It follows repeated source refusals during Dashboard PR469 validation; the original task remains open until independently verified composed acceptance.

## Confirmed problem and regression

Trusted candidate run39099990340 attempt1 and independent main run39100467791 refused the first detailed readiness read after5171ms and5100ms respectively. Candidate attempt2 succeeded without changes, which did not resolve the independently repeated failure. Both failed logs remain preserved; no further blind retries or weakened test/timeout policy is used.

The actual generated ORM query was captured only in a guarded synthetic loopback fixture. EXPLAIN showed the run refusal proof projecting384 Verification points and32 metrics across16 runs for one selected24-point/2-metric run. JIT on/off yielded250.397ms/240.620ms and did not remove the plan problem. This diagnostic is not cloud performance or runtime-role proof.

A regression using the actual ordinary login and scientific-key lookup failed with384 versus24 before the change. A direct known-ID probe was insufficient because it allowed constant propagation and missed the actual lookup pattern. The final regression checks actual rows reaching the proof, without depending on a particular scan node, index choice, hardware duration or CTE name.

## Correction and boundaries

Only the parent Verification-run proof now materializes its selected-run point/metric projections before checking refusal. Both child security-barrier views and all six projection functions remain byte-identical. All refusal predicates, original scientific readers, ordinary role/ACL/receipt checks, repeatable READ ONLY transaction,5s transaction ceiling,4s statement limit and2s lock limit remain unchanged. The materialization is statement-local; it is not shared cache, tenant authority or persistence. Universal forecasts remain shared knowledge; organisation/user access is enforced before the source read.

The SQL candidate and receipt CHECK are version3.0.1, digest `c5d3122371a7f038acf02f7f9f41fce0d34a2cb770e273e6cc78b2c73af31e90`, configuration `sg2-private-stored-forecast-e1-v3-0-1`. The reader, descriptor and three ordinary-role fixtures use the same identity. A negative actual-reader test proves receipt3.0.0 cannot borrow the current digest or reuse an earlier result, and restored3.0.1 works. The prior3.0.0 identity is not silently reused.

## Validation

Final local result:477 operation/actualSQL/API tests plus61 original forecast/snapshot tests, strict typecheck, zero skipped, all PASS. Actual ordinary-role plan regression now projects24 points and2 metrics. Full readiness preserves minimal Current versus complete Verification identity, all four models and both period meanings, latest FAILED state, native/absent band identity, zero/null, source/ACL/revocation/audit refusal and legacy behavior. The original generated query after correction measured41.032ms/19.846ms with JIT on/off in this fixture; these are observations, not a performance SLA or proof that every source delay is eliminated.

Fresh Neon catalog SQL confirms the candidate schema and both named candidate roles are absent on Market Development. The observer was neondb_owner; this is explicitly not a runtime-role proof. No cloud DDL, data, grants or connection configuration changed. Fresh actual Render reads retain the existing deployments and disabled product auto-deploy. Manifest and all eight exact routed paths passed full preflight before begin and again with required begin.

Exact-source controlled CI, independent main proofs, canonical PMOS/MEMOROS/PHR closeout and actual release acceptance remain distinct required evidence. Existing Development/Staging apps remain unchanged. This correction alone does not complete E1, install the source, validate Clerk/browser usage or establish executable release rollback.
