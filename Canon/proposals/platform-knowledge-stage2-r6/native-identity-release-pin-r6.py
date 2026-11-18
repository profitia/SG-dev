# Bounded native transport for the original approved Identity expectedSourceSha release metadata.
import datetime,hashlib,json,os,re,stat,subprocess,sys,urllib.parse,urllib.request,ssl,shlex
BASE='/workspaces/sgdev-tasks/platform-knowledge-stage2-technical-20261117'
SSH=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','sgdev-shared']
def remote(command,data=None):
    p=subprocess.run(SSH+[command],input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120);assert p.returncode==0;return p.stdout
def main():
    mode=sys.argv[1] if len(sys.argv)==2 else 'prepare'
    if mode=='prepare':print(json.dumps({'status':'PREPARED_NOT_EXECUTED','liveCalls':0,'credentialRead':False}));return
    assert mode in ['set','restore']
    if 'RENDER_API_KEY' in os.environ:raise ValueError('UNEXPECTED_EXTERNAL_AUTHENTICATION')
    e=json.loads(remote('node '+BASE+'/accepted-main-tools/identity-release-pin-r6-envelope.mjs '+mode))
    assert e['mode']==mode and e['release']=='__PK_DEPLOYED_SOURCE_SHA__' and e['workspaceId']=='tea-d7lps8rbc2fs73cn80dg' and e['serviceId']=='srv-dbcse6jrjlhs73eib3sg' and e['key']=='IDENTITY_RUNTIME_EXPECTED_SOURCE_SHA'
    assert re.fullmatch(r'https://github\.com/profitia/SG-dev/blob/[a-f0-9]{40}/Canon/evidence/2026-11-18-platform-knowledge-stage2-srm-root-release-r5\.md',e['approvalRef'])
    for k in ['value','expectedValue']:assert re.fullmatch('[a-f0-9]{40}',e[k])
    cfg=os.environ.get('RENDER_CLI_CONFIG_PATH') or os.path.join(os.environ.get('RENDER_CLI_CONFIG_DIR') or os.path.expanduser('~/.render'),'cli.yaml')
    fd=os.open(cfg,os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
    try:
        st=os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid!=os.getuid() or st.st_mode&0o077 or st.st_size>32000:
            raise ValueError('EXISTING_NATIVE_CONFIG_BOUNDARY_REJECTED')
        raw=os.read(fd,32001)
    finally:
        os.close(fd)
    if len(raw)>32000:
        raise ValueError('EXISTING_NATIVE_CONFIG_SIZE_REJECTED')
    text=raw.decode('utf8')
    match=re.search(r'(?m)^api:[ \t]*\n((?:[ \t]+[^\n]*(?:\n|$))*)',text)
    if not match:
        raise ValueError('EXISTING_NATIVE_SESSION_NOT_FOUND')
    block=match.group(1)
    def field(name):
        rows=re.findall(r'(?m)^[ \t]+'+re.escape(name)+r':[ \t]*(.*)$',block)
        if len(rows)!=1:
            raise ValueError('EXISTING_NATIVE_SESSION_FIELD_REJECTED')
        value=rows[0].strip()
        if value.startswith('"'):
            value=json.loads(value)
        elif value.startswith("'") and value.endswith("'"):
            value=value[1:-1].replace("''", "'")
        if not isinstance(value,str):
            raise ValueError('EXISTING_NATIVE_SESSION_VALUE_REJECTED')
        return value
    host=urllib.parse.urlsplit(field('host'))
    if host.scheme!='https' or host.hostname!='api.render.com' or host.port not in (None,443) or host.path not in ('','/','/v1','/v1/') or host.username or host.password or host.query or host.fragment:
        raise ValueError('EXISTING_NATIVE_RENDER_ORIGIN_REJECTED')
    if int(field('expires_at'))<=datetime.datetime.now().timestamp()+10:
        raise ValueError('EXISTING_NATIVE_SESSION_EXPIRED')
    token=field('key')
    if not 16<=len(token)<=2048 or any(ord(c)<33 or ord(c)>126 for c in token):
        raise ValueError('EXISTING_NATIVE_SESSION_KEY_REJECTED')
    import certifi
    certificate_bundle=certifi.where()
    if not os.path.isfile(certificate_bundle):
        raise ValueError('EXISTING_TLS_CERTIFICATE_BUNDLE_REQUIRED')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=certificate_bundle)),NoRedirect())
    service=e['serviceId'];key=e['key'];attempted=False
    def api(route,method='GET',body=None):
        assert route in ['/services/'+service,'/services/'+service+'/deploys?limit=20','/services/'+service+'/env-vars/'+key]
        assert method=='GET' or method=='PUT' and route=='/services/'+service+'/env-vars/'+key and body=={'value':e['value']}
        req=urllib.request.Request('https://api.render.com/v1'+route,data=json.dumps(body).encode() if body is not None else None,method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/json',**({'Content-Type':'application/json'} if body is not None else {})})
        with opener.open(req,timeout=60) as response:
            assert 200<=response.status<300
            if method=='PUT':return response.status
            raw=response.read(2000001);assert len(raw)<=2000000;return json.loads(raw)
    def state():
        s=api('/services/'+service);assert s['id']==service and s['ownerId']==e['workspaceId'] and s['name']=='identity-runtime-development' and s['repo']=='https://github.com/profitia/SG-dev' and s['branch']=='main'
        assert s.get('autoDeploy')=='no' or s.get('autoDeployTrigger')=='off'
        cmd=s['serviceDetails']['envSpecificDetails']['buildCommand'];assert cmd.startswith('test -n "$IDENTITY_RUNTIME_EXPECTED_SOURCE_SHA" && test "$RENDER_GIT_COMMIT" = "$IDENTITY_RUNTIME_EXPECTED_SOURCE_SHA" && ')
        rows=api('/services/'+service+'/deploys?limit=20');rows=[x.get('deploy',x) for x in rows];live=[x for x in rows if x['status']=='live'];active=[x for x in rows if x['status'] in ['created','queued','build_in_progress','update_in_progress','pre_deploy_in_progress']];assert len(live)==1 and not active
        assert any(live[0]['id']==x['id'] and live[0]['commit']['id']==x['sha'] for x in e['expectedLiveChoices']);return live[0]
    live=state();row=api('/services/'+service+'/env-vars/'+key);row=row.get('envVar',row);assert row['key']==key and row['value']==e['expectedValue']
    attempted=True;http=api('/services/'+service+'/env-vars/'+key,method='PUT',body={'value':e['value']})
    row=api('/services/'+service+'/env-vars/'+key);row=row.get('envVar',row);assert row['key']==key and row['value']==e['value'];after=state();assert after['id']==live['id']
    e.update(status='CONFIG_SAVED_WITHOUT_DEPLOY' if mode=='set' else 'LKG_RELEASE_PIN_RESTORED_WITHOUT_DEPLOY',httpStatus=http,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),readbackMatches=True,liveDeployUnchanged=True,allEnvFetched=False,secretDisplayed=False)
    writer="from pathlib import Path;import json,sys,os;b=Path('/workspaces/sgdev-tasks/platform-knowledge-stage2-technical-20261117/evidence');v=json.load(sys.stdin);assert v['journal'] in ['r5-identity-release-pin-set.json','r5-identity-release-pin-restore.json'];p=b/v['journal'];old=json.loads(p.read_text());assert old['status']=='STARTED_OUTCOME_UNKNOWN';assert all(old[k]==v[k] for k in ['taskId','serviceId','release','mode','approvalRef','value','expectedValue']);t=p.with_suffix('.pending');t.write_text(json.dumps(v,indent=2)+'\n');t.chmod(0o600);os.replace(t,p);print('IDENTITY_PUBLIC_RELEASE_PIN_RESULT_RECORDED')"
    remote('python3 -c '+shlex.quote(writer),json.dumps(e).encode());print(json.dumps(e))
if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit('IDENTITY_PIN_OPERATION_STOPPED_RECONCILE_OWN_JOURNAL_AND_PROVIDER_BEFORE_RETRY_NO_CREDENTIAL_DISCLOSURE') from None
