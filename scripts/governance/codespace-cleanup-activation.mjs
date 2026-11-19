import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {managedRequest} from './codespace-cleanup-managed.mjs'

export const PROFILE='/opt/profitia-cleanup-architecture-dev-v1/activation.json'
export const CLASS='architecture-execution-receipt-v1'
export const RESOURCE='execution-receipt-cache'
export function scopeFor(profile,taskId){return path.join(profile.scopeBase,crypto.createHash('sha256').update(taskId).digest('hex'))}
function trusted(file){
 let current='/'
 for(const part of file.split('/').filter(Boolean)){
  current=path.join(current,part);const s=fs.lstatSync(current)
  if(s.isSymbolicLink()||s.uid!==0||(s.mode&0o022))throw Error('Activation profile must be root-controlled')
 }
 if(!fs.statSync(file).isFile())throw Error('Activation profile must be a regular file')
}
export function readProfile(){
 if(!fs.existsSync(PROFILE))return null
 trusted(PROFILE)
 const p=JSON.parse(fs.readFileSync(PROFILE,'utf8'))
 if(p.schemaVersion!=='1.0'||p.class!==CLASS||!['PILOT','ACTIVE','DISABLED'].includes(p.status)||p.projectKey!=='ARCHITECTURE'||p.targetEnvironment!=='development')throw Error('Invalid activation profile')
 return p
}
export function eligible(c,spec,p){
 return !!p&&p.status!=='DISABLED'&&c.projectKey==='ARCHITECTURE'&&c.repository==='profitia/SG-dev'&&c.beginInput?.targetEnvironment==='development'&&
  c.scopeRoot===scopeFor(p,c.taskId)&&spec.timeoutMs<=120000&&
  (p.status==='ACTIVE'||c.taskId===p.pilotTaskId)
}
export function invokeAdmission(c,p,action){
 if(!['start','promote'].includes(action))throw Error('Unsupported activation operation')
 trusted(p.launcherPath)
 const r=spawnSync('/usr/bin/sudo',['-n','--',p.launcherPath,action,'--config',c.configFile],{encoding:'utf8',timeout:30000,maxBuffer:65536,cwd:'/',env:{PATH:'/usr/sbin:/usr/bin:/sbin:/bin',LANG:'C.UTF-8'}})
 if(r.error||r.status!==0)throw Error(`Task broker admission unavailable: ${(r.stderr||r.error?.message||'refused').slice(0,400)}`)
 const ack=JSON.parse(r.stdout)
 if(ack.taskId!==c.taskId||ack.class!==CLASS||!['BROKER_READY','POLICY_ACTIVE'].includes(ack.status))throw Error('Task broker admission identity mismatch')
 return ack
}
// A bounded, useful cache of the actual execution result, not random padding.
// Consumers receive copies of bytes; no directory/file descriptor is exported.
export function receiptPayload(c,bootstrap,workOutput){
 const data={schemaVersion:'1.0',class:CLASS,taskId:c.taskId,projectKey:c.projectKey,
  conversationId:bootstrap.metadata.conversationId,businessResult:bootstrap.result.finalStatus,
  bootstrapSha256:crypto.createHash('sha256').update(JSON.stringify(bootstrap)).digest('hex'),
  workOutputSha256:crypto.createHash('sha256').update(workOutput??'').digest('hex')}
 const bytes=Buffer.from(JSON.stringify(data))
 if(bytes.length>4096||!['SUCCESS','PARTIAL_SUCCESS','FAILED'].includes(data.businessResult))throw Error('Execution cache payload is not bounded canonical metadata')
 return bytes
}
export function consumeReceipt(c,resource,expected,request=managedRequest){
 const r=request(c,'read',resource)
 const b=Buffer.from(r.payloadBase64,'base64'),digest=crypto.createHash('sha256').update(b).digest('hex')
 if(r.status!=='CACHE_READ'||digest!==r.payloadSha256||!b.equals(expected))throw Error('Managed receipt cache read mismatch')
 return JSON.parse(b.toString('utf8'))
}
export function activationFor(c,spec,options={}){
 const p=options.profile??readProfile()
 if(!eligible(c,spec,p))return null
 const admit=options.admit??invokeAdmission,request=options.request??managedRequest
 let resource=null,started=false,issue=null,proof=null
 const note=reason=>{issue=String(reason).slice(0,600)}
 return {
  class:CLASS,
  start(){try{admit(c,p,'start');started=true}catch(e){note(e.message)}},
  cacheResult(bootstrap,output,{allocate,release}){
   if(!started)return {class:CLASS,status:'RETAINED',reason:issue}
   const payload=receiptPayload(c,bootstrap,output)
   resource=allocate({name:RESOURCE,kind:'managed-private-directory',phase:'pre-closeout',bytes:payload.length,seed:payload})
   // The same allocation supplies the result used by two actual consumers:
   // closeout result binding and the task-local recovery checkpoint.
   const result=consumeReceipt(c,resource,payload,request)
   const recovery=consumeReceipt(c,resource,payload,request)
   if(result.bootstrapSha256!==recovery.bootstrapSha256)throw Error('Execution result consumers disagree')
   proof={class:CLASS,status:'CACHE_CONSUMED',resource,reads:2,receipt:result,payloadBytes:payload.length}
   if(bootstrap.result.finalStatus==='SUCCESS'){
    const file=path.join(c.scopeRoot,'execution-cache-release.json')
    const evidence={schemaVersion:'1.0',projectKey:c.projectKey,taskId:c.taskId,kind:resource.kind,path:resource.path,allocationId:resource.allocationId,
     verificationRef:'Canonical bootstrap validated; result and recovery consumers finished; exact bootstrap and required evidence retained outside redundant cache; trusted producer frozen before cleanup.',
     authorization:{resultVerified:true,retentionReleased:true,recoveryPreserved:true,noActiveConsumers:true}}
    fs.writeFileSync(file,JSON.stringify(evidence)+'\n',{flag:'wx',mode:0o600});release(file)
   }
   return proof
  },
  afterCleanup(report){
   if(!resource)return {...report,activation:{class:CLASS,status:'RETAINED',reason:issue??'No eligible execution cache'}}
   const item=report.results.find(r=>r.path===resource.path)
   if(item?.status!=='CLEANED')return {...report,activation:{...proof,status:'RETAINED',reason:item?.reason??'Cache not removed'}}
   const actual=request(c,'status',resource)
   if(actual.physicalAbsent!==true||actual.workerStopped!==true)throw Error('Actual managed cache absence was not verified')
   const stopped=request(c,'stop')
   let policy={status:p.status}
   if(p.status==='PILOT')policy=admit(c,p,'promote')
   return {...report,activation:{...proof,status:'CLEANED_VERIFIED',physicalAbsent:true,workerStopped:true,broker:stopped.status,policy:policy.status}}
  },
  checkpoint(){return {class:CLASS,started,issue,proof,resource}},
  restore(saved){resource=saved?.resource??saved?.proof?.resource??null;proof=saved?.proof??null;issue=saved?.issue??null},
  retain(reason){note(reason)},
 }
}
