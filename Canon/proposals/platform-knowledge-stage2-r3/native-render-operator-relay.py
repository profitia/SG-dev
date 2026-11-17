# Public transport source is maintained in Codespaces. Only an already configured native Render operator identity is used; no local project or credential copy is created.
import os,sys,json,re,stat,pathlib,subprocess,ssl,urllib.request,urllib.error,datetime,shlex
BASE='/workspaces/sgdev-tasks/platform-knowledge-stage2-technical-20261117'
WORKSPACE='tea-d7lps8rbc2fs73cn80dg'
SERVICES={'srv-dbq6n2m7bikc73dmvs8g':'platform-knowledge-development-api','srv-dbq6njec6qcc738fjf50':'platform-knowledge-development-worker','srv-dbcse6jrjlhs73eib3sg':'identity-runtime-development'}
SSH=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','sgdev-shared']
mode=sys.argv[1] if len(sys.argv)>1 else 'prepare'
if mode=='prepare':
 print(json.dumps({'status':'PREPARED_NOT_EXECUTED','sourceLocation':'Codespaces','transport':'Existing native Render operator only; no login, new token, local project write or credential copied to Cloud','liveCalls':0}));sys.exit(0)
e=None;attempted=False
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
def remote(command,data=None):
 p=subprocess.run(SSH+[command],input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
 if p.returncode:raise RuntimeError('REMOTE_REVIEWED_PRECONDITION_FAILED')
 return p.stdout
def save_result(status,**fields):
 a={k:e[k] for k in ['taskId','release','serviceId','mode','journal']}
 if e.get('key'):a['key']=e['key']
 if e.get('targetCommit'):a['targetCommit']=e['targetCommit']
 a.update(status=status,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),**fields)
 raw=remote('python3 '+shlex.quote(BASE+'/record-native-render-result.py'),json.dumps(a).encode())
 parsed=json.loads(raw);assert parsed['status']=='OPERATION_RESULT_RECORDED';return a
try:
 assert mode in ['inspect','set-env','deploy','pause','rollback'];service=sys.argv[2];assert service in SERVICES
 key=sys.argv[3] if len(sys.argv)>3 else None
 if mode in ['set-env','pause'] and key:assert re.fullmatch('[A-Z][A-Z0-9_]{1,100}',key or '')
 command='node '+shlex.quote(BASE+'/render-operation-envelope.mjs')+' '+mode+' '+service+((' '+key) if key else '')
 raw=remote(command);assert len(raw)<=65536;e=json.loads(raw);del raw
 assert e['taskId']=='ARCH-PK-STAGE2-TECHNICAL-CONT-20261117' and e['workspaceId']==WORKSPACE and e['serviceId']==service and e['serviceName']==SERVICES[service] and e['mode']==mode and e['approvedApiOrigin']=='https://api.render.com/v1'
 if mode=='pause':key=e.get('key');assert key=='PK_PROCESSING_ENABLED' and e.get('value')=='false'
 if mode!='inspect':
  go=e['go'];assert go['status']=='APPROVED' and go['renderAuthenticationMethod']=='EXISTING_NATIVE_OPERATOR' and go['nativeRenderTransportSha256']==globals().get('VERIFIED_SOURCE_SHA256')
  assert go['release']==e['release'] and re.fullmatch('[a-f0-9]{40}',e['release'])
  assert datetime.datetime.fromisoformat(go['validUntil'].replace('Z','+00:00'))>datetime.datetime.now(datetime.timezone.utc)
 # Existing official CLI performs ordinary authentication/refresh; no new login or shared-session logout.
 env=dict(os.environ,RENDER_WORKSPACE=WORKSPACE,RENDER_CLI_DISABLE_ANALYTICS='1')
 cli=subprocess.run(['/opt/homebrew/bin/render','whoami','--output','json'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
 assert cli.returncode==0 and b'tomasz.uscinski@profitia.pl' in cli.stdout
 token=os.environ.get('RENDER_API_KEY')
 if not token:
  config=pathlib.Path(os.environ.get('RENDER_CLI_CONFIG_PATH') or str(pathlib.Path(os.environ.get('RENDER_CLI_CONFIG_DIR') or str(pathlib.Path.home()/'.render'))/'cli.yaml')).expanduser()
  st=config.lstat();assert stat.S_ISREG(st.st_mode) and not stat.S_ISLNK(st.st_mode) and stat.S_IMODE(st.st_mode)&0o077==0 and st.st_uid==os.getuid() and st.st_size<32000
  text=config.read_text();blocks=re.findall(r'^api:\s*\n((?:[ ]{2,}[^\n]*(?:\n|$))*)',text,re.M);assert len(blocks)==1
  def field(name):
   rows=re.findall(r'^[ ]+'+name+r': ([^\n]*)$',blocks[0],re.M);assert len(rows)==1;v=rows[0].strip()
   if v.startswith('"'):return json.loads(v)
   if v.startswith("'"):assert v.endswith("'") and "'" not in v[1:-1];return v[1:-1]
   return v
  token=field('key');assert field('host') in ['', 'https://api.render.com','https://api.render.com/v1'];assert int(field('expires_at'))>datetime.datetime.now().timestamp()+10
  del text,blocks
 assert re.fullmatch('[A-Za-z0-9._~+/=-]{20,12000}',token)
 opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl.create_default_context()),NoRedirect())
 def api(route,method='GET',body=None,discard=False):
  allowed=[f'/services/{service}',f'/services/{service}/deploys?limit=20',f'/services/{service}/deploys']
  assert route in allowed or method=='PUT' and key and route==f'/services/{service}/env-vars/{key}'
  req=urllib.request.Request('https://api.render.com/v1'+route,data=json.dumps(body).encode() if body is not None else None,method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/json',**({'Content-Type':'application/json'} if body is not None else {})})
  with opener.open(req,timeout=60) as response:
   assert 200<=response.status<300
   if discard:return response.status
   raw=response.read(2000001);assert len(raw)<=2000000;return json.loads(raw)
 def state():
  s=api(f'/services/{service}');assert s['id']==service and s['ownerId']==WORKSPACE and s['name']==SERVICES[service]
  assert s.get('autoDeploy')=='no' or s.get('autoDeployTrigger')=='off'
  rows=api(f'/services/{service}/deploys?limit=20');assert isinstance(rows,list);rows=[x.get('deploy',x) for x in rows]
  live=[x for x in rows if x.get('status')=='live'];assert len(live)==1
  active=[x for x in rows if x.get('status') in ['created','queued','build_in_progress','update_in_progress','pre_deploy_in_progress']]
  return s,live[0],active
 s,live,active=state()
 if mode=='inspect':
  print(json.dumps({'status':'READ_ONLY','serviceId':service,'workspaceId':WORKSPACE,'name':s['name'],'branch':s.get('branch'),'updatedAt':s.get('updatedAt'),'live':{'id':live['id'],'sha':live.get('commit',{}).get('id')},'active':[{'id':x['id'],'status':x['status']} for x in active],'newAuthentication':False,'credentialDisplayed':False}))
 else:
  assert not active and any(live['id']==x['id'] and live.get('commit',{}).get('id')==x['sha'] for x in e['expectedLiveChoices'])
  if mode in ['set-env','pause']:
   assert e['key']==key and key not in ['OPENAI_API_KEY','CLERK_SECRET_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','DATABASE_URL','PK_DATABASE_URL','RENDER_API_KEY']
   assert isinstance(e['value'],str) and len(e['value'])<16000
   if key=='PK_E1_WORKER_PRIVATE_KEY':assert service=='srv-dbq6njec6qcc738fjf50' and e['value'].startswith('-----BEGIN PRIVATE KEY-----')
   else:assert 'PRIVATE KEY' not in e['value'] and 'sk-proj-' not in e['value']
   attempted=True;http=api(f'/services/{service}/env-vars/{key}',method='PUT',body={'value':e['value']},discard=True);del e['value']
   _,after,queued=state();assert after['id']==live['id'] and not queued
   a=save_result('CONFIG_RECOVERY_SAVED_WITHOUT_DEPLOY' if mode=='pause' else 'CONFIG_SAVED_WITHOUT_DEPLOY',httpStatus=http)
  else:
   target=e.get('targetCommit',e['release'])
   if mode=='rollback':
    assert e['go']['recoveryAuthorized'] is True
    assert target==('f78f5867064c96f4497e13bcd53c97af2da2e07a' if service=='srv-dbcse6jrjlhs73eib3sg' else '1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526')
   else:assert target==e['release']
   attempted=True;deploy=api(f'/services/{service}/deploys',method='POST',body={'commitId':target,'clearCache':'do_not_clear'})
   assert re.fullmatch('dep-[a-z0-9]+',deploy.get('id','')) and deploy.get('commit',{}).get('id')==target
   a=save_result('EXACT_RECOVERY_DEPLOY_ACCEPTED_NOT_YET_LIVE' if mode=='rollback' else 'EXACT_RELEASE_DEPLOY_ACCEPTED_NOT_YET_LIVE',deployId=deploy['id'])
  print(json.dumps(a))
except BaseException as error:
 if isinstance(error,SystemExit):raise
 status='MUTATION_OUTCOME_UNKNOWN_RECONCILE_REQUIRED' if attempted else 'NOT_SENT_PRECONDITION_FAILED'
 if e and e.get('journal'):
  try:save_result(status,reason='REVIEWED_TRANSPORT_OR_PRECONDITION_STOPPED')
  except Exception:pass
 print(json.dumps({'status':'STOPPED','operationStatus':status,'credentialDisplayed':False}),file=sys.stderr);sys.exit(1)
