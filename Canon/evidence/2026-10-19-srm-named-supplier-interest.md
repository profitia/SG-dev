# E1 — authenticated supplier choices in SRM

Task SRM-E1-NAMED-SUPPLIER-INTEREST-20261019. Profile SRM,
TARGET_ENVIRONMENT=development, local isolated workspace. Authority profitia/SG-dev
main; base1594b5ef9170ea6657817d59f8c6c3b63d5e2414. Own srm_pmos and PHR;
MEMOROS disabled by profile. Full E0/E1 remains IN_PROGRESS.

The existing private business adapter now optionally completes RECORD_INTEREST
using the current internal Profitia account and organization. Existing SRM
organization-scoped user surrogates map to that account through an internal key;
they are not new authentication identities. Neither a browser ID, Clerk subject
nor email selects the owner. Existing demo identities/history remain unchanged.

One extracted domain writer persists organization and personal supplier choices
for both the existing demo path and the authenticated path. Global catalog
placeholder creation stays exclusively in the existing demo flow. The named path
requires an already accepted shared company, the original accepted parent/NIP,
current identity/rights/product/module and a current private phase. Business
rows, phase effect and canonical OUTCOME commit together. Replay creates no new
write or logical request quota unit. Its status is not report delivery.

Optional controlled SQL003 adopts only three previously CLOSED user/interest
tables in the NEW disabled private store. Current scope and personal-row fences,
immutable owner/mapping/first-selection fields, database timestamps and protected
history prevent cross-user or cross-organization mutation. Common SQL001–012,
SQL002 business fences and the eighteen-source initializer are unchanged.

Local native acceptance:117 real ordinary PostgreSQL/API tests PASS, zero skips;
strict application TypeScript PASS. Ten new scenarios cover two users in one
organization, one account in two organizations, surrogate/key mapping, absent
shared company, preserved demo history, wrong parent/org/user/NIP, current
revocation, metadata ACL drift, immutable history, audit rollback and repeated
selection/replay. The first local run caught a polymorphic SQL trigger referring
to user_id in the organization-only table; a nested table-specific branch fixed
the new rule. Diagnostics used only synthetic local data and are outside source.

The current manifest explicitly pins eight business sources and SQL003, while
keeping prior dated hashes historical. Product/promotion regressions, build and
exact candidate/main CI remain required before source acceptance. No cloud role,
grant, schema, data, secret, configuration, flag, vendor call, new resource or
product deployment is performed by this finite unit. No endpoint or personal
list UI is activated. Full provider/route parity, live identity/data/recovery and
user-session UAT still precede the separately authorized Development release.

Local remaining checks PASS:499 existing product tests,311 promotion tests,
zero skips; actual Next16/React19 build and strict typecheck. The build-generated
root-params import was preserved outside source and the exact pre-build
next-env.d.ts bytes restored. No unrelated source changes were included.
