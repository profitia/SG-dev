# Platform Knowledge contracts 0.2.0

Public, transport-neutral contract family `profitia.platform-knowledge`. JSON Schema 2020-12 is in `schemas.json`; types and query/cross-field assertions are exported. It contains no ACG, database, SDK or identity-provider dependency. Version 0.2 adds generated whole-document synthesis with original evidence, metadata filters, lifecycle polling and source titles. Query 0.1 remains accepted. A contract package alone is not evidence of runtime or host adoption.

The receiver validates full schemas plus semantic assertions. `assertContextSemantics` counts the entire serialized result with the consumer/model tokenizer, including citations and metadata. Token accounting must reach a fixed point when setting `usedTokens`; a character estimate is not an accepted tokenizer. Exhausted budgets return no evidence with an explicit omission/status, never an oversized bundle. SUMMARY requires one identified document and a verified whole-document coverage manifest; top-k retrieval cannot prove a complete summary. READY additionally requires that manifest verification by the producer.

## Transport and operations

Canonical HTTPS mappings (versioned `/v1`; no runtime implementation in this package):

| Operation | Input → output | Admission and owner |
| --- | --- | --- |
| POST `/v1/imports` | Import → Job + private upload receipt | shared ingestion PLATFORM; private ingestion authenticated UserID |
| GET `/v1/sources/:id` | scoped id → source, progress, coverage and root synthesis | current access to source/content |
| POST `/v1/query` | Query → Context | `ANSWER`, `DOCUMENT_SUMMARY`, `MEMORY_RECALL`; current rights |
| DELETE `/v1/sources/:id` | owner-scoped id + idempotency key → deletion receipt | immediate retrieval revocation, durable purge |
| PUT/DELETE `/v1/memory/consent` | one-time explicit opt-in / withdrawal | canonical internal UserID; default OFF |
| POST `/v1/internal/account-deletions` | AccountDeletionCommand → DeletionReceipt | authenticated Identity lifecycle producer, no active user session |

Binary bytes never belong in context/query. Upload MIME, size and digest are declarations to be checked against actual bytes; no active content or macros are executed. DOC/DOCX and PPT/PPTX converters need isolated resource-limited execution; TEXT means `text/plain`, Markdown `text/markdown`.

Identity is **not** a field in Query or Import. The server supplies a verified operation context from the existing Identity/E1 contract. Browser headers, organisationId, service key, queue payload and JSON `ALLOW` alone confer no data access. ACG cannot forge a private owner. E1/Identity-specific assertions belong to their adapters and owners, not to this neutral package. Worker admission is one scoped durable delegation per job with expiry, revocation/fencing and recheck before publication; no Clerk/E1 round-trip for each chunk.

For ACCOUNT_PRIVATE all persistence uses internal environment-specific UserID and `ownerOrganisationId=null`; author is separate. Source restrictions survive K4/K5 conversion, derivatives, memory and organisation changes. `organisationConstraintId` is a source restriction, not ownership or sharing. UNKNOWN classification never assigns the current organisation or widens rights. Every purpose and external-AI/quote/API grant is independently checked; unknown permission denies that use. Private cross-conversation memory requires current explicit opt-in and lasts at most 180 days, shortened by source restrictions/revocation.

DENIED/EMPTY do not disclose other users' source IDs, counts or titles. Cursors are opaque, scoped, short lived, revocable and cannot bypass current access. Account deletion is idempotent on `(environment,commandId)` with payload collision rejection; Identity owns the account event, PK owns immediate retrieval fencing and eventual private derivatives/backups purge. Legal retention denies retrieval and reports categories/deadlines, not a claim of completed physical purge.

## Adoption boundaries

| Owner | Existing surface | Required change |
| --- | --- | --- |
| ARCHITECTURE / ACG | `packages/assistant-context-gateway` | query family, PK adapter, UserID scope, model token allocation; retain ACTIVE_VIEW behavior and four-producer limit semantics |
| CIC | `profitia/conversational-intelligence-core` | plan natural queries without document ID; deliberate SUMMARY vs ANSWER; citations and absence handling |
| ARCHITECTURE / E1 | `packages/platform-contracts` | versioned private import/search/read/delete, consent/memory, shared publish, service delegation and cleanup operations; existing market knowledge.read is insufficient |
| ARCHITECTURE / Identity | `apps/identity-runtime` and existing identity contract | durable account deletion producer and receipt/retry; distinguish membership/subscription/account |
| SG2 | `apps/sg-runtime` | real session and E1 adapter, upload, opt-in/forget, history invalidation; reserve model window and answer tokens |

PK ranks within its allocation and enforces source rights; ACG ranks/allocates between producers; CIC plans and interprets context; host reserves system/conversation/tool/output tokens. None may silently truncate a table or citation. Independent consumers implement the same access and budget contract without importing ACG.


The executable Stage 2 OpenAPI export `httpContract` describes implemented neutral endpoints; `/openapi.json` publishes it. Publication is a separate whole-document command with explicit `authority` and `acknowledgePartial`. Readiness/status polling uses `/v1/source-statuses`, which returns generic UNAVAILABLE for missing or inaccessible source IDs. Import is a binary body plus base64url JSON `x-pk-import`, not JSON-embedded document content. ACG's optional knowledge subpath does not change the existing ACTIVE_VIEW family or its limits. CIC demand planning is a separately owned optional helper; SpendGuru production-host adoption, memory activation and account-deletion event transport remain Stage 3.

Future consent/account-deletion operations above express v1 contracts, not live Stage 2 endpoints. Stage 2 explicitly rejects memory activation until Identity/host adoption is ready. Consumers must poll current source status before reusing context, respect expiry and invalidate withdrawn/deleted generations; a saved context bundle never becomes a permanent access grant.
