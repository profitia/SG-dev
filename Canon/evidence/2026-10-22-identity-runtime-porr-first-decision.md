# Identity Runtime — reusable core and PORR-first deployment decision

22 October 2026. Owner: Architecture Platform. Profile: ARCHITECTURE. Environment: development. Repository authority: profitia/SG-dev, main.

## Decision and its source

The owner-established business/architecture requirement is **Single Identity Core / Configurable Client Deployments**. Its source is sections 4 and 12 of the owner-supplied task “TASK B2-D — Source Promotion & Controlled Development First Deployment”, task `ARCHITECTURE-IDENTITY-B2-D-FIRST-RELEASE-20261022`, in host conversation `01a15aed-8d94-7fe0-9cff-c54f72b5f8a8`. This is a reference to the actual supplied decision, not a GitHub approval or an invented approval identifier.

The requirement is accepted as business/architecture input. This decision remains the single proposal in [PR #600](https://github.com/profitia/SG-dev/pull/600), extended by owner task `ARCHITECTURE-IDENTITY-B2-E-LIFECYCLE-20261022`, section 4, in the same host conversation. That task explicitly accepts **Event-Driven Administration + Transactional Authorization**. This is the actual owner instruction, not an invented approval ID or GitHub review. Source acceptance/merge of PR #600 remains separate. Neither decision authorizes live authentication.

## One reusable identity core

Maintain one canonical Identity Runtime, authentication/session engine and deterministic Conversational Form Engine. Reuse centrally maintained security and session contracts and the shared visual components derived from [the MagicPath design](https://www.magicpath.ai/files/463393726950178816). Clerk retains authentication authority; Profitia retains internal identities, organisations, memberships and product permissions through the existing Access Store.

Future reviewed configuration may select branding, approved registration/login steps and additional validated client fields. Optional dedicated client deployments may differ in URL, configuration and release lifecycle while using the same canonical source. They must not create permanent source forks, independent identity authority, duplicate B1 databases or separate authentication engines.

## First rollout: PORR, with multiple organisations

`FIRST_DEPLOYMENT_CLIENT = PORR`. Initially one Identity Portal deployment serves the PORR implementation. Multiple Organisation IDs must be supportable within that deployment. Expected later organisational contexts are PORR customer users and Profitia internal testers, kept separate by canonical membership and product permissions.

One client deployment is not one Organisation ID. One identity account is not one organisation membership. An authenticated user is not automatically an authorised product user. A user may later hold several explicitly authorised memberships; session establishment must grant none automatically. A form field, URL or branding choice cannot select trusted organisation authority.

Reuse before duplication: adding an organisation does not require cloning Render infrastructure or Clerk instances. No permanent requirement to create one service per organisation is established. Optional client deployments and organisation membership remain separate architectural concepts.

## Accepted health-only first release

B1 remains INSTALLED_ACCEPTED; B2 is merged at `4115d539501bfd73c4467129caacbadd6c94b8a4`. The completed preparation is recorded in [PHR d67e34a](https://github.com/profitia/project-history-repository/commit/d67e34abd4739c5c9fda41994259d5e29c7b194b). Its immutable records are retained.

[Corrective PR #599](https://github.com/profitia/SG-dev/pull/599), candidate `c8936471e2e295dde0a470361ab309fcd12c37f3`, was separately owner-approved and merged. Actual promotion is `aa95c0a0a14fb2f2ba5af7338c8d83a6fb349269`. Its deployment-owned public origin preserves strict Host validation. [B2-D persisted acceptance](https://github.com/profitia/project-history-repository/commit/75d51ee5890cf40a54d09e3a5198ef411664f68f) records the completed first release; its immutable artifacts are unchanged.

The existing Frankfurt Free native Node Web Service is `identity-runtime-development`, ID `srv-dbcse6jrjlhs73eib3sg`, in workspace `tea-d7lps8rbc2fs73cn80dg`, Architecture project `prj-db717krrjlhs739jgo0g`, Development environment `evm-db717krrjlhs739jgo1g`. URL: https://identity-runtime-development.onrender.com. Deployment `dep-dbcse73rjlhs73eib57g`, build `bld-dbcse73rjlhs73eib580`, source is the actual promotion above. State is **HEALTH_ONLY / IDENTITY_RUNTIME_ENABLED=false**. PORR-first does not imply productive PORR access or a PORR-branded UI.

The separate B2-D owner GO was executed and closed: one build (25.75 seconds), one deployment, no additional observed pipeline charge, Free compute, real ingress/TLS/Host checks, health200/protected503, restart, suspend and resume acceptance. Native Git deployment exposes build/deploy identities, not an OCI digest; do not invent one. The first-deployment no-prior-artifact constraint is historical. Future releases need their own executable LKG/rollback gate and owner authorization.

B2-E read-only provider verification confirms the same service/environment, Free plan, one steady-state instance, auto-deploy off and unchanged service update time. B2-E performs no deployment, configuration mutation or resource creation. This acceptance does not cover live Clerk/browser SSO or multiple-process flow-state correctness.

## Event-Driven Administration + Transactional Authorization

Future organisation administration is a server-side authenticated and authorised command within the administrator's current organisation and explicit delegated scope. The command persists the authoritative membership/permission/product change and its actor/operation/provenance audit in the same controlled Access Store transaction. A frontend notification is not an administrative mutation. No administration UI or new administrator grant is created here.

Every protected business operation must independently validate current identity, membership, product entitlement and relevant permission. Reuse `createPrivateOperationHost`, `createAccessStore.lockAccess`, SQL `profitia_access.lock_access`, policy/version fencing, transaction-local scope and audit. Product effects and OUTCOME commit together. Never reuse an ALLOW or lease from an earlier transaction, trust browser roles, or infer access from a successful login.

The accepted shared installation fence orders concurrent work: an admitted operation holding FOR SHARE can finish before a waiting administration commit; after the administration commits, subsequent admissions see its new revision and rights. An administration transaction that rolls back changes neither effective rights nor the committed revision. This is commit ordering, not retroactive cancellation of already committed work. External Clerk revocation is checked independently and is not made atomically transactional with PostgreSQL by this rule.

Optional events may refresh visible actions, navigation and access-loss messages. They cannot grant/preserve authority, supply a cached ALLOW, or replace backend checks. Continuous permission polling, an event bus, WebSocket infrastructure and a monitoring service are **not required**. Existing SDK token maintenance is authentication lifecycle activity, not permission polling.

Clerk owns authentication/session validity. B1 owns the internal permanent User ID and issuer/subject binding. Access Store owns organisations, memberships and product rights. Product backends enforce current authority per protected operation. PORR membership suspension does not revoke the permanent identity, Clerk session or independent Profitia membership. Global account revocation is a different explicit operation.

PORR customer and Profitia internal organisations are intended independent contexts, not records created by this decision. Email domains, branding, portal URLs and Clerk metadata grant no membership. The [B2-E preparation runbook](../runbooks/identity-runtime-lifecycle-and-persistent-login-v1.md) details bounded renewal proposals, persistent login, restart options, test evidence and the separate activation gate. Its proposed renewal policy is not an approved live policy.

## Deferred work and preserved boundaries

No UI, form engine, schema extension, deployment manager, no-code builder, client cloning, additional instance, per-organisation Clerk instance, organisation onboarding, automatic assignment or consumer integration is implemented here. No PORR/Profitia organisation record, user, membership or grant is created. Product source, database schema/data, Clerk configuration, credentials and deployments remain unchanged.

The health-only service requires no Clerk, Neon, binding, policy or attestation secret. B1 app/binding remain DISABLED with no profile policy. Live Clerk/browser SSO, binding renewal (including expired-but-not-revoked recovery), PII retention, multi-process rollout behaviour and consumer adoption require separate acceptance. C/D later build a conversational form over accepted backend/session contracts; no general-purpose AI chat, iframe authentication or second session mechanism is introduced.

Canonical ARCHITECTURE PMOS/PHR records the factual execution and approval state independently of this source proposal. MEMOROS is DISABLED_BY_PROFILE. Future execution must preserve the actual owner approval reference and must not infer operational consent from this architectural requirement.
