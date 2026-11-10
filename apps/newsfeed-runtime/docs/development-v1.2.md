# Newsfeed saved searches — Development activation

This source change implements the HUMAN saved-search workflow. It does not
activate infrastructure, paid acquisition or a private SERVICE worker.
Use the existing Newsfeed service and database; no new resource is needed
for the HUMAN API. Preserve existing Source UNMETERED policies and retention0.

## Installation

Accept the exact source candidate and CI before any installation. Verify the
existing Development recovery point and physical binding:
`shiny-bonus-85532609 / br-wispy-bonus-b9ohunab / neondb`.
Never use Staging/Production, a pooled migration connection or an owner login
as the ordinary runtime. Keep credentials in the existing protected store.

Current E1 SQL002 must already be installed. The fixed sharing projection
also requires this narrow, separately admitted Identity-owner step:

```sql
SET LOCAL ROLE profitia_access_owner;
GRANT USAGE ON SCHEMA profitia_e1_receiver TO newsfeed_development_owner;
GRANT EXECUTE ON FUNCTION profitia_e1_receiver.scope_allows(text,uuid,uuid,boolean)
TO newsfeed_development_owner;
```

Run it only through the accepted owner procedure in an explicit transaction;
restore the original role before COMMIT. It exposes no key or identity table,
does not grant runtime SET ROLE and does not widen any SG2/SRM permission.
The domain migrator refuses to grant these rights itself. If they are absent,
it returns `SHARED_READ_PROOF_VALIDATOR_GRANT_REQUIRED`.

Using the existing protected direct migrator connection, inject
`NEWSFEED_MIGRATOR_DATABASE_URL` and `NEWSFEED_ENVIRONMENT=development` into the
process, then run from the repository root:

```sh
node --input-type=module -e "import{createHash}from'node:crypto';import{readFileSync}from'node:fs';console.log(createHash('sha256').update(readFileSync('apps/newsfeed-runtime/migrations/003-saved-searches.sql')).digest('hex'))"
npm --prefix apps/newsfeed-runtime run db:migrate -- --saved-searches --expected-sha256 APPROVED_EXACT_DIGEST
```

Replace `APPROVED_EXACT_DIGEST` with the accepted first command's digest, not a
copied historical value. The installer verifies the binding, dependencies,
ordinary migrator properties and stored digest, takes an advisory lock and
uses one additive transaction. Re-running the same digest is idempotent.
The backend `/ready` stays false until the new marker is present.

## Product paths and privacy

- `/v1.2/observations`: create, paginated private/shared/organisation lists.
- `/v1.2/feed`: one chronological stream from currently authorised observations,
  deduplicated within each private index and paginated with explicit topics.
- `/:id`: read, optimistic edit, pause/resume and owner deletion.
- `/:id/discover`: explicit new acquisition through the existing Source Hub
  client, with an idempotency key. Never triggered by opening/replaying a view.
- `/:id/history`, `/:id/publications?runId=...`: immutable run replay.
- `/:id/publications?q=...`: paginated search of the stored title index.
  A `publicationId` selection opens a specific still-authorised notification
  target without loading or searching the rest of the archive.
- `/:id/statistics`:4/8 calendar weeks, literal phrases, unknown dates and
  truthful index-only coverage; no provider or model calls.
- `/:id/shares`: owner-controlled ORG/read-only grants and USER invitations.
  An invitation is a one-use,24-hour resource token, transmitted in a POST
  body after arrival from a URL fragment. Only its digest is stored. The
  recipient is always the actual current E1 user in the same organisation.
- `/v1.2/invitations`: authenticated acceptance; no supplied owner/recipient ID.
- `/v1.2/notifications`: persistent own-user events and read state.
- Existing `/v1/assistant-context`: bounded stored metadata under current E1;
  it reads the new index when installed, without discovery or AI execution.

Sharing does not change the underlying private policies. Fixed SECURITY
DEFINER projections validate the original signed current-E1 scope and exact
runtime, lock the selected ACL/resource, release only bounded domain data and
offer no arbitrary SQL, owner-context switching or write access to recipients.

## Remaining activation dependencies

Private monitoring needs an accepted, revocable SERVICE/delegation contract,
the Newsfeed component's own admitted technical binding and public Ed25519
key. None can be replaced by an Oil/SG2 identity or a fabricated Clerk session.
Until admitted, recurring definitions are `WAITING_AUTHORIZATION` and there is
no worker polling private observations. Source quotas/licences are unchanged.

Deploy only the accepted exact SHA with separate deployment authority. Verify
`/ready`, real-session CRUD/replay/sharing/revocation and unauthorized denials.
Any paid upstream test needs its own actual admission. Offline fixtures are
not live provider results. Test/infrastructure evidence and the handoff belong
in PHR, not a local evidence directory.

Rollback uses the verified previous runtime SHA; the additive schema leaves
the original `/v1` columns and contracts usable. Do not drop the new data or
restore the shared database as an automatic rollback.
