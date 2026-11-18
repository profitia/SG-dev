"""Existing native Render session transport only. No project checkout or credential files are written."""
import datetime, hashlib, json, os, re, stat, subprocess, sys, urllib.parse

RELAY_SHA256='3c2876367196e1a4e957a9849f3d576f87fde7273877c8627ab2d8e913dde340'
BASE='/workspaces/sgdev-tasks/platform-knowledge-stage2-technical-20261117'
SERVICES={'srv-dbq6n2m7bikc73dmvs8g','srv-dbq6njec6qcc738fjf50','srv-dbcse6jrjlhs73eib3sg'}
MODES={'inspect','set-env','deploy','pause','rollback'}

def main():
    args=sys.argv[1:]
    if len(args) not in (2,3) or args[0] not in MODES or args[1] not in SERVICES:
        raise ValueError('INVALID_REVIEWED_OPERATION')
    if 'RENDER_API_KEY' in os.environ:
        raise ValueError('UNEXPECTED_EXTERNAL_AUTHENTICATION')
    p=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','sgdev-shared','cat '+BASE+'/native-render-operator-relay.py'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45)
    if p.returncode or hashlib.sha256(p.stdout).hexdigest()!=RELAY_SHA256:
        raise ValueError('REVIEWED_RELAY_SOURCE_MISMATCH')
    relay=p.stdout
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
    previous_ca=os.environ.get('SSL_CERT_FILE')
    os.environ['RENDER_API_KEY']=token
    os.environ['SSL_CERT_FILE']=certificate_bundle
    del token, raw, text, block, match
    sys.argv=['native-render-operator-relay.py',*args]
    try:
        exec(compile(relay,'verified-native-render-operator-relay.py','exec'),{'__name__':'__main__','VERIFIED_SOURCE_SHA256':RELAY_SHA256})
    finally:
        os.environ.pop('RENDER_API_KEY',None)
        if previous_ca is None:
            os.environ.pop('SSL_CERT_FILE',None)
        else:
            os.environ['SSL_CERT_FILE']=previous_ca

if __name__=='__main__':
    try:
        main()
    except Exception:
        raise SystemExit('EXISTING_NATIVE_RENDER_TRANSPORT_FAILED_WITHOUT_CREDENTIAL_DISCLOSURE') from None
