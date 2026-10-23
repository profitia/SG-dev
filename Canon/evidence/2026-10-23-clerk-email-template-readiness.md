# Clerk email readiness — Development, 2026-10-23

Task: `ARCHITECTURE-CLERK-EMAIL-READINESS-20261023`. Owner/profile: ARCHITECTURE. Workspace: SG-dev Architecture, isolated local branch `architecture/clerk-email-readiness-20261023`. Authority: `profitia/SG-dev`, main. Base refreshed to `7991e502df9da663c840989226e29369e361f10c`; concurrent PR667 changes preserved without modification. Target: Development only. MEMOROS canonically disabled; task history in `architecture_pmos`, never SRM/SG2/CIC PMOS.

Authorized scope: previously accepted steps 1–3 (map MagicPath designs, prepare Polish male/female/neutral templates, investigate native Clerk variable/conditional capabilities), Full Autopilot; additional explicit application rename. No runtime deployment, migration, profile/metadata write, permission grant, new sender, webhook activation or live email send.

## Live evidence

- Existing Clerk application `app_3KoJk9FmKeTC4hhlQwTgX6PMZmD`, Development instance `ins_3KoJk8us60Ywqei67JBwUx6R5pi`.
- Application name changed from `profitia-platform-development` to **SpendGuru PORR**, saved and independently reloaded. `app.name` also rendered the new name in the default email preview. App/instance IDs, domains, keys and authentication settings unchanged. Reversal: restore previous name in Application settings and Save; no database rollback involved.
- Signup verification code ON, verification link OFF; signin code ON, link OFF. Email catalogue exposes Invitation and Verification code as available. The three Email link templates remain unavailable. No feature toggles changed.
- `verification_code` variable selector explicitly includes `user.public_metadata`. `invitation` selector explicitly includes `invitation.public_metadata`. Screenshots recorded in local delivery evidence. Neither selector advertises `SignUp.unsafeMetadata` or a guaranteed signup-before-user avatar context.
- Two unsaved source/subject probes were attempted in the editor. Server preview rendered the stored default template, not the probe. **Conditional backend result is inconclusive**, not a failed avatar condition. Both probes discarded; page reload confirmed original subject/body and no unsaved indicator. Delivered by Clerk ON for both templates; Reset to default disabled. No template Save used.
- Native metadata is a viable candidate for existing accounts/invitations, not yet an accepted universal route. Private Neon profile is not automatically injected. The initial registration case and process-specific copy are separate unresolved context questions.
- Auto-review rejected fetching a Clerk API secret from Render environment for a direct API probe. That path was abandoned; no key was fetched and no rejected script was executed. Continued through the logged-in Clerk UI. No alternate credential harvesting.

## Prepared source and rollback

Five declared target files only: catalog with eight design revision references, offline generator, usage/mapping/activation notes, tests, this evidence. No runtime imports. Fifteen static variants (five message purposes × male/female/neutral) plus two conditional candidates. Branch/source preparation can be discarded or reverted without runtime/data impact. The app rename is the only persisted external product change.

Graphics in design source are public HTTPS PNG files with content-hash filenames. Verified sizes: SpendGuru logo 480×154 / 15,604 bytes; PORR logo 226×144 / 3,644 bytes; male 1254×1254 / 1,482,275 bytes; female 1254×1254 / 1,347,118 bytes. Downloaded hashes match filename hashes. Existing `/porr-demo/` candidates on PORR and SRM Development returned 404; do not claim those assets are deployed. Package keeps source URLs and documents optimization/managed hosting before activation.

## Acceptance boundary

Preparation is independently reviewable. Template variables, mapping and persisted rename verified live. Native personalized delivery, first-registration preference propagation, consumer metadata synchronization, mailbox rendering and actual code/link use are **not accepted** by this task. They must pass before activation. No Render deployment or Neon product mutation was performed or required; pre-deployment LKG gate is not applicable. Source checks are not runtime or customer acceptance.

## Executed checks

- Identity runtime suite: **193 passed, 0 failed**. The first sandboxed run could not bind a local test HTTP server (`EPERM`); the authorized rerun outside that sandbox passed. This was an execution-environment restriction, not an application failure.
- Focused offline email suite: **21 passed**, including all 15 variants, provider placeholders, neutral fallback, conditional-candidate structure and non-overwriting export. Repeated successfully after the visual correction below. These tests do not execute Clerk's Handlebars backend.
- Identity lint and typecheck passed. Governance preflight passed with all five declared targets owned by ARCHITECTURE.
- Unsaved Clerk editor imports checked: male OTP desktop/mobile and female invitation desktop. The editor initially propagated the CTA's white link color to the fallback link within one rich-text block. Changed the native export to separate `re-button` and `re-link` elements; the fallback then rendered blue and readable. Native bubble uses a supported single radius. Draft imports discarded and saved defaults restored; delivery remains enabled.
- Fifteen variants export to 64 files, including two additional conditional candidates, manifest and instructions. Re-import/render evidence is distinct from mail-client and actual-send acceptance.

The detailed interpretation and future acceptance cases are in `apps/identity-runtime/email-templates/README.md`.
