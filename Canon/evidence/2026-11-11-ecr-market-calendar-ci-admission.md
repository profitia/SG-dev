# ECR Market Calendar — exact CI-policy proposal

Status: PROPOSED / OWNER_CI_APPROVAL_PENDING / NOT_ACTIVATED.

PMOS: ARCHITECTURE-ECR-MARKET-CALENDAR-CI-20261111.
Host: 01a19bde-d925-7eb3-bb0d-718fe3bce137.
Producer PR1018: e3e0f54d85e20ad12b8e98ec87a37fcaea32fea1.
Producer base: a9194acae09132e6570fe8071bf327125ebb8577.
Policy preparation base: b6df3533750d0278440b0a432e412731bff47a42.

Four policy files only: controller, its existing tests, shared integration
runbook and this evidence. Closed17-entry map SHA-256:
da30940a57a48a97230c7b59567311c29028da8e5b8bad24a8409199195c66ac.
Producer record: 91d4301899b43c8dba5c3720162f3c61888db087bc8ebfd3563fe151fbb5dc37.
Prepared private-access plan: caadc0cdf9322e218db6f1f9285d52ef5fe5ceaca84f672d77fe49e8fa44a1d0.

Actual results before activation:

- ECR full suite41/41 PASS in isolated local PostgreSQL; build/typecheck and
  manifest PASS; seven producer source tests PASS.
- Producer GitHub backend/governance PASS. Integration exposed four expected
  historical recurring-source fingerprint failures and requires exact controlled
  proof. This pure trusted projection preserves the original receipts.
- Two new CI tests PASS: exact identity/routing/mode/closure and real Git-byte
  predecessor/receipt checks, including consumer scope/dependency tampering.
  Full existing controller, public/controlled/resulting-main checks remain due.
- SG2 synthetic functional tests7/7 and consumer integrity2/2 PASS. Local browser
  layout/keyboard/deep-link/dark/mobile checks are not Development acceptance.
- Registered ARCHITECTURE preflight PASS; native PMOS registration exists.
  Lifecycle remains open; MEMOROS disabled by profile. No false closeout claim.

The independent UX/implementation approval is not CI-policy or E1-grant
approval. Explicit owner decision is required before activation. No private
rights, migrations, releases, SourceHub/Identity runtime, provider acquisition,
resource, retention or notification delivery has been changed.
