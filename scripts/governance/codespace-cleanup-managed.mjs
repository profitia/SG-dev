import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'

export const MANAGED_KIND='managed-private-directory'
const protocol='PROFITIA_CLEANUP_INSPECTOR_V1'
function trusted(file){
  if(typeof file!=='string'||!path.isAbsolute(file)||path.normalize(file)!==file)throw Error('Canonical managed deployment path required')
  let current='/'
  for(const part of file.slice(1).split('/')){
    current=path.join(current,part);const s=fs.lstatSync(current)
    if(s.isSymbolicLink()||s.uid!==0||(s.mode&0o022))throw Error('Managed deployment is not root-controlled')
  }
  if(!fs.statSync(file).isFile())throw Error('Managed deployment must be a regular file')
}
export function managedRequest(config,action,resource=null,options={}){
  trusted(config.inspectorDescriptor)
  const p=JSON.parse(fs.readFileSync(config.inspectorDescriptor,'utf8'))
  if(p.mode!=='managed-private-v1'||p.protocol!==protocol||p.executionUid!==process.getuid()||p.executionUid===0||p.executionGid!==process.getgid())throw Error('Managed deployment principal/mode mismatch')
  for(const key of ['projectKey','taskId','repository','scopeRoot','sourceRoot'])if(p[key]!==config[key])throw Error('Managed deployment task/source mismatch')
  trusted(p.modulePath);trusted(p.pythonPath)
  if(crypto.createHash('sha256').update(fs.readFileSync(p.modulePath)).digest('hex')!==p.moduleSha256)throw Error('Managed worker source hash mismatch')
  const request={protocol,requestId:crypto.randomBytes(20).toString('hex'),action,
    ...Object.fromEntries(['projectKey','taskId','repository','scopeRoot','sourceRoot'].map(k=>[k,config[k]])),
    phase:options.phase??resource?.phase??config.phase??'pre-closeout',
    ...(resource?{path:resource.path,allocationId:resource.allocationId,kind:resource.kind,identity:resource.identity,authorization:resource.authorization}:{}),...options}
  const result=spawnSync(p.pythonPath,['-I',p.modulePath,'managed-client','--descriptor',config.inspectorDescriptor],{
    input:JSON.stringify(request),encoding:'utf8',timeout:40000,maxBuffer:2_000_000,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}})
  if(result.error||result.status!==0)throw Error(`Managed worker unavailable/refused: ${(result.stderr||result.error?.message||'unknown').slice(0,500)}`)
  const reply=JSON.parse(result.stdout)
  if(reply.protocol!==protocol||reply.requestId!==request.requestId||reply.referenceProtection!=='PRIVATE_SINCE_CREATION_NO_FD_EXPORT')throw Error('Managed reply identity/protection mismatch')
  if(resource&&(reply.path!==resource.path||reply.allocationId!==resource.allocationId||reply.kind!==MANAGED_KIND))throw Error('Managed reply resource mismatch')
  if(action==='allocate'&&!resource&&(!reply.path?.startsWith(config.scopeRoot+'/')||reply.kind!==MANAGED_KIND||!/^[a-f0-9]{32}$/.test(reply.allocationId??'')))throw Error('Managed allocation outside scope')
  return reply
}
