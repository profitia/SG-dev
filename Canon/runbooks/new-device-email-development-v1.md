# New-device security email — Development

Owner: Architecture Platform. Repository authority: `profitia/SG-dev:main`.
Task: `ARCHITECTURE-NEW-DEVICE-EMAIL-20261025`.

## Scope and existing notification

The existing Clerk Development instance `ins_3KoJk8us60Ywqei67JBwUx6R5pi`
already sends `new_device_sign_in`. Its native delivery remains enabled during
preparation. Do not disable the notification, replace the session authority,
rewrite a provider revocation token, or change authentication/access policies.
Do not infer user language or avatar from an address, country or browser name.

MagicPath project `460980331948945408` (Logowanie PORR):

- PL component/revision `465176061597077504` / `465182867748720640`.
- EN component/revision `465176072246398976` / `465182875512377344`.
- Reference sign-in email `464300252657258496` / `464433014601052160`.

Both languages reuse the canonical SpendGuru/PORR assets and Profitia footer.
Male/female appearance is a presentation preference, never the user's sex.
Unknown preferences use the existing neutral representation. Previews use
synthetic data, including documentation IP `192.0.2.10`; their button does not
revoke a real session. Actual messages contain normal selectable text/HTML,
plain text, and the existing CID image pipeline; no scripts or typewriter animation.

## Transport and security

The existing signed `email.created` boundary accepts the new slug only when
`IDENTITY_NEW_DEVICE_EMAIL_ENABLED=true` supplies explicit revocation origins.
The default remains disabled. Events already delivered by Clerk remain ignored
to preserve one delivery owner. The parser retains signature/timestamp/instance,
bounded payload, suppression, exact subject/address verification and queue controls.

The original provider fields are `sign_in_method`, `browser_name`,
`operating_system`, `location`, `ip_address`, `session_created_at`,
and optional `revoke_session_url`. The notification requires the signed
provider user/address pair. The SDK verifies that the address still belongs to
the same current provider account. IP literals, bounded nonempty details and
trusted HTTPS action origins are checked. URLs with credentials, fragments,
whitespace or backslashes are refused. The original opaque action URL is retained
verbatim; the application never constructs a replacement and never visits it.
Without a URL the mail contains an administrator-contact instruction, no fake CTA.

The existing ordinary-role service boundary reads the current saved communication
language and avatar at delivery time; it never grants product access, renews a human
binding or updates the profile. Queue payloads remain encrypted and are cleared on
settlement. Unknown provider submissions are not automatically retried.
The envelope sender remains the existing approved sending identity. The current
native English subject is retained. Only the body is localized.

## Required acceptance before cutover

1. Accept the exact source PR after all required checks. A draft or chat design
   preview is not a production/deployment approval.
2. Independently read the current Development runtime deployment, configuration,
   measured artifact digest, health and retained rollback availability. Preserve
   its source SHA, deploy ID and private configuration. Do not reuse an expired
   snapshot as evidence. This change has no schema migration or product-data write.
3. Publish the six immutable `mailgunTemplate('new-device-sign-in', avatar,
   language)` versions to the existing `spendguru.app` EU domain. Retain names,
   exact version tags/digests and a provider readback. Never overwrite an existing
   version with different content. No new service, sender or credential is needed.
4. Deploy only `identity-runtime-development` (`srv-dbcse6jrjlhs73eib3sg`),
   using the exact accepted source and the existing plan. Keep native Clerk
   delivery enabled. Enable the new boolean only in the approved Development
   configuration. Do not alter SG2/SRM services or Staging/Production.
5. Observe an actual signed provider notification with native delivery still ON.
   Verify field names/types, non-null user/address binding and actual revocation
   origin against the prepared contract. Do not log or publish the URL token,
   recipient, request IP, private body or raw signature. A screenshot of a mail
   and a locally signed fixture do not establish this webhook compatibility.
6. Only after the owner authorizes the cutover, switch **Delivered by Clerk** OFF
   for this exact security template; keep **Enable Sign in from new device** ON.
   Do not change other templates. Test using an explicitly authorized synthetic
   account/new browser session, PL and EN, correct saved avatar, inbox rendering,
   single delivery, original session-specific revoke action and protected API
   denial afterward. Do not revoke an owner's or another user's real session.
7. Independently verify provider message/template/version, queue settlement and
   ciphertext removal, persisted profile preference, health and no access grant.
   Provider acceptance, local tests and a green deploy alone are not E2E acceptance.

## Rollback

On an unexpected payload, rejection, unknown delivery, missing inbox delivery or
incorrect session action, stop cutover. Restore **Delivered by Clerk=ON** for
`new_device_sign_in` first, leaving its notification enabled. Disable the new
runtime flag. If necessary restore the retained exact previous runtime deployment
and its private configuration through Render's supported rollback. Do not clear
pending/outbox/audit by hand or replay uncertain sends. No database restore,
destructive migration, grant change, consumer deployment or new infrastructure
is part of this rollback.

Keep ARCHITECTURE PMOS continuity open while execution awaits the operational
approval/acceptance. Final canonical closeout must distinguish prepared source
from actual mail delivery and independently verify PHR/pending/lock postconditions.
