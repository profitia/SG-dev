from pathlib import Path
import subprocess,json,hashlib,sys,os,re
B=Path('/workspaces/sgdev-tasks/platform-knowledge-stage2-technical-20261117')
SOURCE='65b0e573f270ded93bfda088a88e736abc45f56a'
POLICY='e105a31c8f9047f51cc8fd9b41b74afcbd565747'
ROOT=B/'worktrees/pk-acg-final-release-20261118'
RELEASE_TOKEN='__PK_'+'DEPLOYED_SOURCE_SHA__'
SQL_TOKEN='__PK_'+'IDENTITY_SQL_SHA256__'
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,stderr=subprocess.PIPE)
def validate_tree(tree,cohort,policy):
 assert len(cohort['entries'])==145
 for name,e in cohort['entries'].items():
  assert git('ls-tree',tree,'--',name).decode().strip()==e['mode']+' blob '+e['sha']+'\t'+name,name
 a=json.loads(git('show',tree+':apps/architecture-lab/knowledge-source.json'))
 assert sha(git('show',tree+':apps/architecture-lab/knowledge-source.json'))=='7bde334dda3ec7068d3cb532ccd8a94f3477cea707abe250431ee16c3b044bf4'
 assert len(a['sourceDigests'])==478
 for name,h in a['sourceDigests'].items():assert sha(git('show',tree+':'+name))==h,name
 for name,h in policy['ownedPolicyFiles'].items():assert sha(git('show',tree+':'+name))==h,name
 return a

def validate_gate(gate,release):
 assert re.fullmatch('[a-f0-9]{40}',release)
 assert gate['status']=='PASS' and gate['releaseSha']==release and gate['approvedSourceFreeze']==SOURCE and gate['sourceAccepted']is True
 assert gate['requiredReleaseCi']==gate['resultingMainCi']=='PASS' and gate['sourceCiValidatedSha']==gate['sourceProofCandidateSha']==release
 for key in ['sourceProofControlSha','resultingMainValidatedSha']:assert re.fullmatch('[a-f0-9]{40}',gate[key])
 for key in ['sourceProofOriginalArtifactSha256','resultingMainProofOriginalArtifactSha256']:assert re.fullmatch('[a-f0-9]{64}',gate[key])

def main():
 mode=sys.argv[1]if len(sys.argv)>1 else 'prepare'
 if mode=='prepare':print(json.dumps({'status':'PREPARED_NOT_EXECUTED','sourceFreeze':SOURCE,'queries':0,'secretRead':False}));return
 assert mode=='materialize' and len(sys.argv)==3
 release=sys.argv[2];assert re.fullmatch('[a-f0-9]{40}',release)
 go=json.loads((B/'evidence/owner-r6-execution-go.json').read_text())
 assert go['taskId']=='ARCH-PK-STAGE2-TECHNICAL-CONT-20261117' and go['status']=='APPROVED' and go['sourceFreeze']==SOURCE and go['mechanicalRuntimeTransportAuthorized']is True and go['policyProposalSha']==POLICY and go['policyReviewedTransportSha']=='627f4bfa43b073c3228bbf8293f7fe4b82f88af2'
 assert go['hostConversationId']=='01a1e7fb-aa2e-7501-b3d7-5f42be90cb14' and go['approvalSource']=='DIRECT_HUMAN_REPLY_IN_CURRENT_CHAT'
 import datetime
 assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(go['validUntil'].replace('Z','+00:00'))<=datetime.datetime(2026,11,24,23,59,tzinfo=datetime.timezone.utc)
 reviewsha=go['reviewSha'];assert re.fullmatch('[a-f0-9]{40}',reviewsha)
 assert go['approvalRef']=='https://github.com/profitia/SG-dev/blob/'+reviewsha+'/Canon/evidence/2026-11-18-platform-knowledge-stage2-acg-composition-release-r6.md'
 def public(name):return git('show',reviewsha+':Canon/proposals/platform-knowledge-stage2-r6/'+name)
 manifest=json.loads(public('execution-asset-digests.json'));assert manifest['sourceFreeze']==SOURCE
 assert sha(Path(__file__).read_bytes())==manifest['files']['render-r6-selected-release.py']
 templates={name:public(name)for name in manifest['files']}
 for name,data in templates.items():assert sha(data)==manifest['files'][name]
 gatebytes=(B/'evidence/runtime-release-accepted-and-ci-pass.json').read_bytes();gate=json.loads(gatebytes)
 validate_gate(gate,release)
 git('fetch','--quiet','origin','main');git('merge-base','--is-ancestor',SOURCE,release);git('merge-base','--is-ancestor',gate['sourceProofControlSha'],release);git('merge-base','--is-ancestor',release,'origin/main');git('merge-base','--is-ancestor',POLICY,'origin/main');git('merge-base','--is-ancestor',go['policyReviewedTransportSha'],'origin/main');git('merge-base','--is-ancestor',gate['resultingMainValidatedSha'],'origin/main')
 cohort=json.loads(templates['closed-source-review.json']);policy=json.loads(templates['approved-policy-inputs.json']);assert cohort['sourceSha']==SOURCE and policy['originalPolicyProposal']==POLICY
 a=validate_tree(release,cohort,policy)
 assert not git('diff','--name-only',release,'origin/main','--',*a['sourceDigests']).strip()
 for name,h in policy['ownedPolicyFiles'].items():assert sha(git('show','origin/main:'+name))==h
 target=B/'worktrees'/('pk-r6-runtime-'+release);selectionpath=B/'evidence/r6-runtime-release-selection.json';assert not target.exists() and not selectionpath.exists()
 git('worktree','add','--detach',str(target),release)
 sql=templates['identity-owner-install-r6.sql'].replace(RELEASE_TOKEN.encode(),release.encode());sqlhash=sha(sql)
 def render(data):return data.replace(RELEASE_TOKEN.encode(),release.encode()).replace(SQL_TOKEN.encode(),sqlhash.encode())
 active=B/'r6-active-execution-inputs';assert not active.exists();active.mkdir()
 for name,data in templates.items():(active/name).write_bytes(render(data))
 for name in ['pk-r6-execution-guard.mjs','execute-reviewed-identity-r6.mjs','execute-reviewed-product-r6.mjs']:(B/name).write_bytes(render(templates[name]))
 for name in ['identity-release-pin-r6-envelope.mjs','native-identity-release-pin-r6.py']:(B/'accepted-main-tools'/name).write_bytes(render(templates[name]))
 selection={'status':'EXACT_CI_VALIDATED_TRANSPORT_SELECTED','sourceFreeze':SOURCE,'release':release,'root':str(target),'approvalRef':go['approvalRef'],'gateSha256':sha(gatebytes),'identityOwnerSqlSha256':sqlhash,'automaticShaUpdateScope':'IDENTICAL_145_478_AND_APPROVED_TWO_POLICY_POSTIMAGES_ONLY','providerOperations':0}
 selectionpath.write_text(json.dumps(selection,indent=2)+'\n');print(json.dumps(selection))
if __name__=='__main__':main()
