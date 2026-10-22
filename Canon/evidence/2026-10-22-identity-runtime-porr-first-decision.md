# Identity Runtime — reusable core and PORR-first deployment decision

22 October 2026. Owner: Architecture Platform. Profile: ARCHITECTURE. Environment: development. Repository authority: profitia/SG-dev, main.

## Decision and its source

The owner-established business/architecture requirement is **Single Identity Core / Configurable Client Deployments**. Its source is sections 4 and 12 of the owner-supplied task “TASK B2-D — Source Promotion & Controlled Development First Deployment”, task `ARCHITECTURE-IDENTITY-B2-D-FIRST-RELEASE-20261022`, in host conversation `01a15aed-8d94-7fe0-9cff-c54f72b5f8a8`. This is a reference to the actual supplied decision, not a GitHub approval or an invented approval identifier.

The requirement is accepted as business/architecture input. This separate governance-only record is proposed for source review; it does not activate routing, an application, infrastructure or authentication. It must not be inserted into the already reviewed corrective PR #599.

## One reusable identity core

Maintain one canonical Identity Runtime, authentication/session engine and deterministic Conversational Form Engine. Reuse centrally maintained security and session contracts and the shared visual components derived from [the MagicPath design](https://www.magicpath.ai/files/463393726950178816). Clerk retains authentication authority; Profitia retains internal identities, organisations, memberships and product permissions through the existing Access Store.

Future reviewed configuration may select branding, approved registration/login steps and additional validated client fields. Optional dedicated client deployments may differ in URL, configuration and release lifecycle while using the same canonical source. They must not create permanent source forks, independent identity authority, duplicate B1 databases or separate authentication engines.

## First rollout: PORR, with multiple organisations

`FIRST_DEPLOYMENT_CLIENT = PORR`. Initially one Identity Portal deployment serves the PORR implementation. Multiple Organisation IDs must be supportable within that deployment. Expected later organisational contexts are PORR customer users and Profitia internal testers, kept separate by canonical membership and product permissions.

One client deployment is not one Organisation ID. One identity account is not one organisation membership. An authenticated user is not automatically an authorised product user. A user may later hold several explicitly authorised memberships; session establishment must grant none automatically. A form field, URL or branding choice cannot select trusted organisation authority.

Reuse before duplication: adding an organisation does not require cloning Render infrastructure or Clerk instances. No permanent requirement to create one service per organisation is established. Optional client deployments and organisation membership remain separate architectural concepts.

## Bounded first-release proposal and approval gate

B1 remains INSTALLED_ACCEPTED; B2 is merged at `4115d539501bfd73c4467129caacbadd6c94b8a4`. The completed preparation is recorded in [PHR d67e34a](https://github.com/profitia/project-history-repository/commit/d67e34abd4739c5c9fda41994259d5e29c7b194b). Its immutable records are retained.

[Corrective PR #599](https://github.com/profitia/SG-dev/pull/599), exact candidate `c8936471e2e295dde0a470361ab309fcd12c37f3`, remains a separate source approval. Its strict deployment-owned public origin corrects the demonstrated health-only Host mismatch without weakening Host validation or changing session contracts. The [candidate first-release runbook](https://github.com/profitia/SG-dev/blob/c8936471e2e295dde0a470361ab309fcd12c37f3/Canon/runbooks/identity-runtime-development-first-release-v1.md) defines exact build/start/configuration and stop controls.

The operational proposal is one Frankfurt Free native Node Web Service, `identity-runtime-development`, in existing Render workspace `tea-d7lps8rbc2fs73cn80dg`, Architecture project `prj-db717krrjlhs739jgo0g`, Development environment `evm-db717krrjlhs739jgo1g`. Only HEALTH_ONLY / `IDENTITY_RUNTIME_ENABLED=false` is proposed. The logical PORR-first decision does not imply productive PORR access or a PORR-branded UI.

The task expressly withholds merge, infrastructure and spending permission. One separate combined owner GO must cover the exact PR candidate; one service and first deployment; Free compute plus at most USD 25 additional Performance pipeline spend, one build attempt and a 20-minute build limit; and the exact health-only configuration, restart and stop/cancel/suspend plan. Before that GO: OWNER_APPROVAL=PENDING, FIRST_DEPLOY_EXECUTED=NO. Source promotion SHA, service hostname/ID and deploy/artifact identifiers remain unknown until verified execution. There is no prior Identity Runtime LKG artifact.

Creation can initiate deployment. It must establish the exact project/environment atomically; no create-then-relocate repair is allowed. After GO, revalidate source, provider inventory, quotas/cost, hostname, settings and cancel/suspend capability. Actual Render ingress/TLS/Host, protected503, restart and stop tests remain unexecuted. Historical CI/local readiness is not live provider acceptance.

## Deferred work and preserved boundaries

No UI, form engine, schema extension, deployment manager, no-code builder, client cloning, additional instance, per-organisation Clerk instance, organisation onboarding, automatic assignment or consumer integration is implemented here. No PORR/Profitia organisation record, user, membership or grant is created. Product source, database schema/data, Clerk configuration, credentials and deployments remain unchanged.

The first service requires no Clerk, Neon, binding, policy or attestation secret. B1 app/binding remain DISABLED with no profile policy. Live Clerk/browser SSO, binding renewal, PII retention, multi-process rollout behaviour and consumer adoption require separate acceptance. C/D later build a conversational form over accepted backend/session contracts; no general-purpose AI chat, iframe authentication or second session mechanism is introduced.

Canonical ARCHITECTURE PMOS/PHR records the factual execution and approval state independently of this source proposal. MEMOROS is DISABLED_BY_PROFILE. Future execution must preserve the actual owner approval reference and must not infer operational consent from this architectural requirement.
