# BQL v1.0 — PCI first

The Benchmark Domain classifies the existing metadata snapshot with `bql-semantic/1.0.0`. This is separate from PCI model eligibility and from historical calculation readiness. No new endpoint, persistence, authentication, E1 lookup, provider lookup, enrichment, history retrieval, retry or deployment is introduced by classification.

`classifyBenchmark(candidate)` returns provider/series identity, rule version, semantic class, reason and the ordered metadata inputs. Currency, units and economic description must agree; one signal is insufficient. Provider `DataType` describes sampling and `Class` stock/flow; neither proves that a series is a price. Opaque provider codes and AI ranking do not decide classification. Missing/conflicting evidence stays undetermined.

`assessPciEligibility(profile, valueKind?)` evaluates PCI only. Both existing PRICE_LEVEL and PRICE_INDEX variants remain supported. The generic Shared Picker shows meaning and preserves selection for every candidate. PCI opts into eligibility explicitly. Finder retains every result and its existing ranking.

Saved selections derive their profile from the already-loaded provider mapping metadata inside the existing organization-authorized response. The profile is not a new persisted source or cross-tenant cache. It is recomputed on response projection. Its evidence snapshot identifies the input version without rewriting earlier sources. A stale/foreign rule or series profile is not reused. This first version does not promise a metadata refresh service; changed provider metadata become visible through the existing mapping lifecycle.

PCI shows qualification before preparation. Known incompatible quantities/rates/other measures require replacing the benchmark; an incompatible declared variant requires correcting that explicit declaration. Unknown semantics remain visibly unverified and keep the existing explicit-declaration flow. No user-entered name, share, date, benchmark identity or draft is automatically corrected or discarded. No new server override or refusal code is introduced. Client guidance never grants access and does not replace server validation.

History, native cadence, closed common periods, missing/duplicate observations, positive levels, purchase date, economic-period approval, FX and calculations stay in existing preparation, CCI and Indexed Price. A qualified price can still receive `DUPLICATE_NATIVE_PERIOD` or another original Core refusal. Semantic suitability never means READY.

PL/EN qualification labels and explanations are shared by Finder/Picker/PCI. UI package receives optional typed presentation props; it imports no Benchmark Domain, networking or host identity. The complete editable component list and native layer remain intact.

Validation: deterministic cases include nominal price, stock quantity, price index, rate, FX, nonprice index, aggregate money, conflicting/missing metadata, sampling fields and AI neutrality. These tests and integration cases are included through the existing mandatory Shared Picker test suite. Browser acceptance and live acceptance must be reported separately; fixtures do not establish live Clerk/Macrobond acceptance.
