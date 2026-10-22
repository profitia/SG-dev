# TASK02-R FAST-TRACK — limited Development UAT preparation

Task **SRM-SUPPLIER-LOCATIONS-TASK02-R-20261022** continues under the original
SRM registration cmvj0baur0000t43u7k05vcpm, RUNNING. Environment Development;
execution local. This checkpoint is **PARTIAL**, not release or live UAT.
The companion JSON contains the exact release inputs and consolidated gate.

## Implemented source

The existing supplier header now contains one official Google Maps icon directly
after NIP/KRS/PKD in its metadata row. It preserves supplier identity and report
state. The glyph is30px inside44px; spacing24px/16px at desktop/narrow widths.
Accepted MagicPath MAP-01 revision464039002702499840 was independently read;
no MagicPath mutation or simulated map was copied into runtime.

The existing location controller/editor and real Maps embed are reused. The
shared C27 history modal supplies the canonical geometry/close control, native
background inertness/scroll lock and explicit keyboard boundary. Browser tests
found React autoFocus captured the wrong return target; initial close-button
focus now happens after showModal and cleanup closes the dialog before restoring
the connected launch target. X/Escape and forward/reverse Tab passed on the
actual component. Existing consumers retain the same modal API and behavior.
Maps ready follows its real rendered event, failure offers retry; no coordinates
means a readable address and no iframe/fabricated pin. Closing/context changes
unmount the existing connection. Selecting a real marker marks its list item.

Limited production composition passes HEADQUARTERS_MANUAL **server side**,
never provides the KYS reader and rejects RELATED_ENTITIES/ALL location reads
before data access. A KYS-source sync host is denied. Client requests cannot
select a wider scope. Manual writes retain E1 parent CREATE and exact-child/CAS
checks. The read-only access recheck uses the allowed headquarters collection.
The existing general KYS report functionality and financial/MGBI continuity are
untouched. Flags remain NOT_ACTIVATED and paid geocoding budgetZERO.
Old P1 receiver application fingerprints are retained in a separate immutable
history before recalculating the new current application closure.

## Verification and limits

- Source/controller/receipt tests12/12, no skips; typecheck and final buildPASS.
- Real disposable PostgreSQL16 ordinary-role location suites43/43, no skips.
  The new UAT test proves accepted MGBI sync never invokes an available KYS
  reader, creates no related derivative, denies KYS/ALL reads and still reads
  HQ/manual. Existing parent/child, quotas100/101, replay, two-user sharing,
  cross-organisation/revocation and rollback tests pass. Producer tests were
  reused from the accepted immutable owner evidence instead of reimplemented.
- Governance/workspace/current KRS routing39/39, no skips.
- Actual browser component tests: native modal, X/Escape, focus return, both Tab
  boundaries, empty/missing-address/permission-denied states, no fake pin.
  At390px there is no horizontal overflow; computed target44px and gap16px;
  at1280px gap24px. Four attached screenshots use explicitly synthetic data
  and transport. **They are not live SRM/Clerk/Neon UAT evidence.**
- Fresh ordinary-role Neon read: SQL019/020/SRM013/014 objects all absent.
  SRM and Maps live deploy identities unchanged. Recovery branchready,
  restored from the requested snapshot/LSN and nondefault. Snapshot expiry
  still absent from API; original R2 coverage remains82/105 with23 pending.
  No protected recovery query, Finalize Restore, grant/key/binding or deployment.

## Integration and one owner decision

Original owner PRs604/607/608/611/613 remain separate immutable source inputs.
The bounded Architecture correction PR618 fixes actual KRS CI mixed-owner
routing; exact owner CI39809698998 and governance39809699479 pass. It preserves
all source, PostgreSQL/artifact/consumer checks and reports changed dependency
trees truthfully. No trusted credential controller policy is weakened.

The current canonical integration runbook has no accepted atomic all-owner
transport procedure. Producer/consumer source cannot be merged separately with
mismatched platform versions. PR618 therefore includes a **pending** narrow
publication proposal; it is not self-authorizing. Assemble/test only a local
exact-source composite until that owner decision. Independent owner CI does
not imply global composite CI PASS or merge approval.

Consolidated package **srm-task02-r-fasttrack-owner-gate-v1** in the JSON separates
SOURCE GO, original R2 scoped owner/operator read approvals, lawful Clerk/B1
cohort and exact privileges/key delivery, then INSTALLATION GO and ACTIVATION GO.
It does not waive any gate or request a speculative service window. Installation
must verify actual SQL preconditions:019 and HMAC before020; SRM013 after019;
SRM014 after both020 and013. Retain the measured previous artifact/config receipts,
refresh actual rollback suitability and all affected live applications before
an explicitly approved <=60minute window. A rebuild of an old SHA is not LKG.

PR614 remains a source-only Identity onboarding proposal; a current lawful
three-user cohort/lifecycle is not proved. KRS616/617 are concurrent separate
owner candidates, excluded from this release;617 overlaps SRM receipt/index/tests.
No conflict-free maintenance window is inferred from absent evidence.

Nadrzędny TASK02-R pozostaje RUNNING; FINAL_PHR=NOT_PUBLISHED_TASK_RUNNING.
No merge, live SQL, deployment, source purchase or feature activation performed.
