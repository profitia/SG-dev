# Mailgun avatar sandbox — evidence, 23–24.10.2026

Task: `ARCHITECTURE-MAILGUN-AVATAR-DELIVERY-20261023`; profile ARCHITECTURE; target Development. User selected **sandbox testing and preparation of male/female integration** after inspection found one active sandbox and one confirmed recipient. The second user-specified test address was added to the sandbox confirmation flow; still pending at the last read. No paid plan, domain, DNS or deployment was created.

## Source and governance

- Authority: `profitia/SG-dev`, main `c33b2f4122d87428c9b95af65803fdfd989dc7cd` when implementation began. Isolated branch `architecture/mailgun-avatar-delivery-20261023`; existing work preserved.
- Root AGENTS, active manifest, CORE/ARCHITECTURE canon and wrappers loaded. Every mutation batch used refreshed main and fail-closed preflight with exact Architecture-owned, ALIGNED targets; PMOS begin registered in `architecture_pmos` as `cmvli7v9z0000tfqyrm8vzfll`.
- Approved templates inherited from PR #668 at `6f634c815fd841b5d3081756f79b85ca94303c60`; this task adds resolved rendering, sandbox samples, transport and bounded operator-batch deduplication. No auth route imports the sender.
- No credentials in source, artifacts or logs. The supplied RTF key was read into process memory and used only for the official US Mailgun API. HTTPS certificate validation stayed enabled.

## Checks

- Identity lint, typecheck and build PASS.
- Full Identity suite: **209 passed, 0 failed** after inline-image correction. Initial restricted local run could not bind loopback; authorized rerun passed. Final targeted suite after additional image-reference hardening: **37 passed, 0 failed**.
- Governance regression: **24 passed, 0 failed**.
- Tested male/female parallel messages, neutral fallback, sample-ID conflict/replay, bounded memory, strict recipient allowlist, header/list injection, wrong environment/domain/region, malformed provider responses, redirects, sanitized errors, timeout/ambiguous outcome without auto-retry, HTML escaping, OTP leading zeroes and trusted invitation URLs.
- Tested multipart inline PNG filenames and bytes, all required CID references, exclusion of the other avatar, missing/duplicate/unreferenced files, external image references, invalid PNG/SVG and unknown filenames.
- Exact approved public PNG hashes verified against URL filenames. Sizes: logo 15,604 B; PORR 3,644 B; male 1,482,275 B; female 1,347,118 B. No binary files added to the repository.

## Actual sending

Four explicitly labelled sample messages were sent to the one confirmed user test mailbox. Each contains the non-functional sample code `000000`; no Clerk code was generated, read or consumed.

| Sample | Mailgun provider ID prefix | Evidence |
| --- | --- | --- |
| male, remote images | `20261023215846.db68fa002c63997a` | `accepted`, then `delivered`, SMTP 250; user confirmed receipt but reported image placeholders |
| female, remote images | `20261023220220.16dd0f52e784fe68` | `accepted`, then `delivered`, SMTP 250 |
| male, inline CID images | `20261023220539.2419e05c8373c6ee` | `accepted`, then `delivered`, SMTP 250 |
| female, inline CID images | `20261023220547.29b61976acde3ee2` | `accepted`, then `delivered`, SMTP 250 |

The image issue was not hidden by a successful SMTP status. Corrected samples attach the two logos and the chosen avatar directly as PNG MIME parts and use matching CID references. Tracking is off; SMTP TLS and certificate verification are required. Browser previews of the approved HTML and both source avatars were inspected. Rendering in the recipient's actual email client remains a distinct acceptance check pending their response; browser screenshots and delivery logs do not prove it.

Receipts, local one-time send intents and previews are held in the operator's `PORR/Mailgun-sandbox-20261023` output folder. These contain sample IDs and safe delivery status, no provider secrets. Initial receipts remain intact; corrected samples have distinct IDs, not silent retransmissions.

## Runtime boundary and open integration gates

Clerk `Delivered by Clerk` remains ON. No live webhook was installed and no private account preference was read or projected for these operator-selected samples. This proves sandbox transport/render selection, **not automatic first-registration, login or invitation routing from Neon**.

Render readback: Identity Development remains on deployment `dep-dbds1g4ipgvc739uj05g`, SHA `a6ffcefb96d1b4182764343b349dcb092d0f891b`, status `live`. No Render configuration/deployment, Neon product data/schema, grants, SG2/SRM/KRS, Staging or Production changes were made. LKG deployment capture and product-DB restoration were not applicable because no deployment/data mutation occurred.

Before live provider cutover: verified sending domain, signed/instance-bound events, demonstrated pre-signup correlation, approved least-privilege E1 service projection of private avatar preference, durable deduplication and safe retries/expiry, secret configuration, real code verification tests, LKG/rollback and controlled switch. The in-memory test batch is not a production webhook ledger. See [runbook](../runbooks/mailgun-avatar-delivery-development-v1.md).

The code is prepared for review as a sandbox slice. General provider migration and automatic preference lookup remain explicitly deferred by the user's sandbox decision.
