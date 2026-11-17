# Isolated mutable execution checkout — exact activation pending

Status: PREPARED / NOT_AUTHORIZED_FOR_ACTIVATION. Task ARCH-CLOUD-DEVELOPMENT-STANDARD-CONT-20261116, ARCHITECTURE / Development, Governance Source Layer. The owner must decide the final exact reviewed SHA before protected policy activation.

The standard main d453458f and its full public run43927379806 succeeded after the read-only job-token credential model and three exact package Actions Read grants. Independent admission1090 accepted main a577efb2ce83ff809e41f445ec7a7a86bf604bd0. The unchanged one-document pilot1088 refreshed to5b22bfd50b4552721cb66bf549db84abf0837823 and live run43938027414 passed credential preflight, trusted-record resolution, physical source check, clean installation, actual API/persistence/revocation tests, typecheck and build, then correctly failed SOURCE_CHECKOUT_DIRTY while producing its proof. No passing artifact was fabricated.

A fresh independent Git clone in the existing Codespace reproduced this using only the exact accepted public Prisma 5.22.0/client5.22.0 generator and the unchanged market-data schema, with nonfunctional loopback placeholder configuration and no real data or credential access. The generator overwrote the two tracked client bootstrap files index.js and index.d.ts, then created11 untracked output files under apps/sg-runtime/generated/market-data-client. Global ignore configuration was disabled in the reproduction. The original strict source guard correctly rejected this dirty tree.

This package keeps that strict guard and all product schemas, runtime imports, generated stubs and dependency pins unchanged. It creates a separate local Git execution checkout from the exact verified input SHA, preserving history through existing local Git object sharing. Private installation still ignores lifecycle scripts and targets that execution checkout. After credentials end, trusted code verifies the exact clean execution inputs. Lifecycle/tests/build run only there. The original input checkout remains separate and is fully checked again before proof. The execution checkout must retain its recorded directory, commit and tree; generated build outputs may mutate its working files. This is ordinary build isolation, not a new agent/framework/service or a dirty-source exception.

Exact-source proofs additionally require ISOLATED_GIT_CHECKOUT, the exact execution SHA, and before/after source-input verification. Historical authority-main proof decoding remains compatible; new proof metadata is checked when present. No permission, package version, approval scope, record expiry, Environment or resource is expanded. No second exception to mandatory pre-merge CI is requested.

The existing bounded Codespace Actions helper also needs a transport-only compatibility update to forward the already approved source_admission_id workflow input. Prepared helper SHA25656b671a6d1fe11f80308de01bbea4848317a85c3eb87eed211aa8168b5255783, replacing c69e8fc0947dfed653e939a0ee4f25eb99dc74e165641111c340e742cbf771e4. Twelve isolated tests pass without loading the credential API/key. All non-main AST, API code, fixed repository/workflow/main, modes, Codespace fence and exact PR/SHA guards are unchanged. The helper remains unapplied until the consolidated activation decision.

Prepared-code validation:

- 316/316 controller, workflow-path coverage and shared Development execution tests pass, with zero failures/skips. SHA256 seals confirm the tested source files did not change during execution.
- 46/46 governance tests pass; governance manifest and ARCHITECTURE routing/require-begin pass. The unchanged five workflow-path coverage tests are included in the 316 total.
- Four new isolation tests cover independent working files, dirty/extra original inputs, SHA/directory/symlink/HEAD substitution and credential-free workflow sequencing. Generic-proof negative cases reject absent/wrong isolation metadata.
- Actual Prisma 5.22 generation ran in the proposed isolated checkout. Its two tracked bootstrap changes and 11 new files were confined to that checkout. Both preserved input hashes remained identical, the accepted strict source guard still passed for that input, and an intentionally added unapproved source file was still rejected.
- The existing assertSourceCheckout implementation is byte-identical to accepted main; application files, Prisma schemas, dependency locks, package grants, admission record and runtime configuration are unchanged.
- Twelve helper compatibility tests pass without reading the credential file. The current shared helper remains at its original SHA256 and is not yet changed.

These results prepare the exact proposal; they do not assert a successful GitHub run of the new policy before it is accepted. Normal pre-merge controlled validation uses independently accepted main. The eventual merge must have all applicable checks, then the new main and refreshed unchanged pilot must prove the isolated execution policy in actual GitHub Actions.

Normal exact-head controlled and public checks remain mandatory before acceptance, followed by actual new-main and trusted-record pilot validation. The pilot original source75ef419444f3d7476243c656079b35e504dab81a, exact blobf359291d379815c3b443792bab56d83051180a39 and record digest5732d2cea362d8208babf9cde0941c007bc8a7474c5cf6cf9555bf25b3284add are unchanged. Incorporating fresh accepted main remains within the original owner-approved pilot scope; no product deployment or existing feature takeover is included.

The exact prepared helper change below is part of the consolidated activation request. It forwards one existing workflow selector and grants no admission authority.

```diff
--- existing/actions.py
+++ proposed/actions.py
@@ -25,12 +25,14 @@
  if os.environ.get('CODESPACE_NAME')!='sg-dev-shared-development-pjxxv4556rx52rvww':raise ValueError('Wrong Codespace')
  p=argparse.ArgumentParser(description=__doc__);s=p.add_subparsers(dest='action',required=True)
  d=s.add_parser('dispatch');d.add_argument('--mode',required=True,choices=['validate-sg2','policy-probe','integration']);d.add_argument('--pr',type=int);d.add_argument('--sha')
+ d.add_argument('--source-admission-id',help='Optional trusted-main source record selector; never candidate authority')
  r=s.add_parser('run');r.add_argument('id',type=int)
  l=s.add_parser('list');l.add_argument('--limit',type=int,default=5)
  rr=s.add_parser('rerun-failed');rr.add_argument('id',type=int)
  a=p.parse_args()
  if a.action=='dispatch':
   if bool(a.pr)!=bool(a.sha):raise ValueError('PR and exact SHA required together')
+  if a.source_admission_id is not None and (a.mode!='validate-sg2' or not a.pr or not re.fullmatch('[A-Za-z0-9][A-Za-z0-9:_.-]{0,199}',a.source_admission_id)):raise ValueError('Source selector requires validate-sg2, exact PR/SHA and a valid record ID')
   if a.sha and not re.fullmatch('[0-9a-f]{40}',a.sha):raise ValueError('Invalid exact SHA')
   if a.pr:
    pr=api(REPO+'/pulls/'+str(a.pr))
@@ -39,6 +41,7 @@
   if workflow.get('path')!='.github/workflows/platform-contracts-ci.yml':raise ValueError('Workflow identity mismatch')
   inputs={'mode':a.mode}
   if a.pr:inputs.update(candidate_pr=str(a.pr),expected_sha=a.sha)
+  if a.source_admission_id is not None:inputs['source_admission_id']=a.source_admission_id
   result=api(REPO+'/actions/workflows/'+str(WORKFLOW)+'/dispatches','POST',{'ref':'main','inputs':inputs})
   result={'operation':'dispatch','repository':'profitia/SG-dev','workflowId':WORKFLOW,'ref':'main','inputs':inputs,'result':result,'dispatchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
   (BASE/'last-dispatch.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
```
