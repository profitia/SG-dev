# Accepted SRM ADP public package — controlled SG2 CI admission

Status: **PROPOSAL / SOURCE ACCEPTANCE PENDING**. Task: `SG2-ADP-PUBLIC-PACKAGE-CI-ADMISSION-20261028`. Profile: SG2 / Development. This is a prerequisite for the separate SG2 Consumer, not a host integration or release.

## Authority and reason

The active ADP presentation mounting amendment v1.1 and PR #756 registered `packages/srm-adp-ui/**` as SRM-owned public UI. The human owner subsequently approved source PR #759, exact head `4639b46fbfcdc07f449237ae84032c9def21d823`. That source was manually accepted into authority `main` at `52c30c8b2dbbee6d3cc98639be01afcf042a2d23`. Its own PR workflow `40662401744` and main workflow `40664127637` passed; candidate artifact `12804931123` was independently downloaded and checked. Contract/package version is 1.0.0; public source digest is `ddff073ecef0fa95b396f860c6e28639b7d3060f61903ad278c300ff30c5bbc2`.

The trusted-main SG2 controller currently admits only two local package names. An ordinary `file:../../packages/srm-adp-ui` adoption would fail before the credential phase. The consumer must not evade this guard with a private import, source copy, alias or candidate-supplied allowlist.

## Exact proposal

Add only `@profitia/srm-adp-ui` → `../../packages/srm-adp-ui` to the existing `LOCAL_PACKAGES` map. The existing package/manifest/source checks then apply without a new bypass:

- exact name and canonical in-repository path; no alias, registry substitution, nested install, traversal or symlink;
- package version agrees with the consumer lock; an authority package manifest must already exist;
- private package versions/integrities, registry configuration, workspaces and overrides retain their existing guards;
- the credential phase still runs only trusted-main validation and `npm ci --install-links --ignore-scripts`;
- candidate lifecycle/tests execute only after credentials are removed, with the existing exact-candidate/control proof.

The public package itself remains SRM-only writable. SG2 receives no authority to change SRM source, its workflow, product data or services. The future consumer must additionally adopt the fixed presentation contract and digest in its own receipt and verify them against actual source bytes.

## Validation and activation boundary

The controller/path-coverage suite passes **89/89**, including existing credential/proof fences. Real temporary filesystem tests now exercise source name/version/authority/private-dependency/symlink rejection for each of the three admitted packages. Offline `npm install-links` fixtures independently prove that prepare/postinstall do not execute with a synthetic credential and that the installed package is a copy rather than a link. Actual current SG2 metadata remains valid with the accepted public package addition.

This proposal changes only the controller, its tests and this evidence. It changes no workflow pin, trusted branch/environment, secret, private artifact, app manifest/lock, routing registry, runtime or provider configuration. Exact-head remote CI and normal source approval are still required. PR #759 approval does not approve this policy PR. Until accepted to authority main, the new local package remains inadmissible to privileged SG2 CI; no alternate execution path is authorized.
