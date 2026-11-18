from pathlib import Path
import sys,json,os
b=Path('/workspaces/sgdev-tasks/platform-knowledge-stage2-technical-20261117')
a=json.loads(sys.stdin.buffer.read(20000));assert set(a)<=set(['taskId','release','serviceId','mode','key','journal','status','deployId','httpStatus','finishedAt','reason','targetCommit'])
assert a['taskId']=='ARCH-PK-STAGE2-TECHNICAL-CONT-20261117';assert a['serviceId'] in ['srv-dbq6n2m7bikc73dmvs8g','srv-dbq6njec6qcc738fjf50','srv-dbcse6jrjlhs73eib3sg']
assert a['mode'] in ['set-env','deploy','pause','rollback'];expected='native-render-'+a['serviceId']+'-'+(a['key'] if a['mode']=='set-env' else a['mode'])+'.json';assert a['journal']==expected and '/' not in expected
p=b/'evidence'/expected;old=json.loads(p.read_text());assert all(a.get(k)==old.get(k) for k in ['taskId','release','serviceId','mode','key','targetCommit']);assert old['status']=='STARTED_OUTCOME_UNKNOWN'
assert a['status'] in ['CONFIG_SAVED_WITHOUT_DEPLOY','CONFIG_RECOVERY_SAVED_WITHOUT_DEPLOY','EXACT_RELEASE_DEPLOY_ACCEPTED_NOT_YET_LIVE','EXACT_RECOVERY_DEPLOY_ACCEPTED_NOT_YET_LIVE','NOT_SENT_PRECONDITION_FAILED','MUTATION_OUTCOME_UNKNOWN_RECONCILE_REQUIRED']
old.update({k:v for k,v in a.items() if k!='journal'});tmp=p.with_suffix('.pending');tmp.write_text(json.dumps(old,indent=2)+'\n');tmp.chmod(0o600);os.replace(tmp,p)
print(json.dumps({'status':'OPERATION_RESULT_RECORDED','operationStatus':old['status'],'serviceId':old['serviceId'],'secretDisplayed':False}))
