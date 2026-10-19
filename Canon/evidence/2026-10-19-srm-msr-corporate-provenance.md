# Original MSR fact provenance in the corporate Source classifier

Date: 2026-10-19. Project: SRM. TARGET_ENVIRONMENT=development; execution: isolated local source and PostgreSQL fixtures. Authority base: `profitia/SG-dev/main` at `4c5e8286036307ed15a1ccedd49d1d5b2b582949`.

Task: `SRM-E1-MSR-CORPORATE-PROVENANCE-20261019`. This is a finite correction to the existing corporate publisher, separately registered from `SRM-E1-FULL-NATIVE-COMPANY-20261019`. It is not live activation or completion of E1.

## Confirmed defect and behavior

The actual full company fixture downloaded and parsed an original MSR document, committed its private READY receipt and report snapshots, then failed classified publication. The existing classifier allowed only structured-provider `content.*` fact paths. The original MSR projector correctly produces `<record>.iXBRL.<fact>` or `<record>.XHTML.<cell>` provenance instead. Renaming that provenance or discarding financial facts would conceal the defect.

The existing closed reader now recognizes those two formats under explicit classification `srm-corporate-fields-v2`. A lowercase HEX24 record must match the actual financial period's document identity and current/comparative suffix. Format must match the original IAS projection basis, IAS_IFRS and the affirmative IAS flag. The same period, scope, metric, amount, currency and unit remain required. Original MSR facts must be VALID SOURCE_VALUE with equal normalized and source amounts. The bounded fact/cell identifier excludes control characters, whitespace and URL/path delimiters. Structured-provider paths remain supported and cannot relabel a known original-MSR period as `content.*`.

The packet version, field-schema JSON, single publisher, original calculator, SQL and independent Source authority are unchanged. This is classification and provenance validation, not proof of licensing or a detector of personal information hidden in arbitrary text.

## Actual evidence

Five unit tests PASS, zero skips. Positive facts come from the actual decoder, parser and projector for iXBRL and positioned XHTML, including comparative periods and scale normalization. Negative cases reject a foreign document, wrong format/IAS basis/flag, relabeling, non-source normalization, review or changed source values, empty/URL/control/oversized fact identifiers, private owner fields and unknown packet properties. Existing detached serialization, accessor, symbol, cycle and size refusals remain active.

The separate full-company task's actual ordinary-role fixture passes the original MSR download, private READY checksum, financial projection and independent classified publication. Its first failing run is retained; it was not counted as success. The first positioned unit fixture omitted the primary-statement evidence required by the original parser; the fixture was corrected with explicit original-style primary cells without weakening the parser.

## Boundaries and continuity

Only the existing reader, its unit test and this evidence belong to this task. Full composition, historical/current source receipts and integration evidence belong to the separately registered producer task. No shared SDK, SQL, field schema, cloud role/grant/configuration/data/secret, provider purchase, Maps change or product deployment is performed here. Live Source metadata will require the explicit new classification during its separately gated activation; this document does not claim it is active. Own SRM Development PMOS/PHR applies; MEMOROS is disabled. Exact-source acceptance and canonical closeout require independent subsequent verification.
