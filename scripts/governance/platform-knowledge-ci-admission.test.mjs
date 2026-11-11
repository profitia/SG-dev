import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {PLATFORM_KNOWLEDGE_G1_REVIEW as review,selectCandidate,assertArchitectureCheckout,PRIVATE_PACKAGES,LOCAL_PACKAGES} from './controlled-package-ci.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const base='d88adf594dfa51cd2011c2567dfc5f6506f6ffc1'
const files=()=>Object.entries(review.blobs).map(([filename,sha])=>({filename,sha,status:review.statuses[filename]}))
const context={repository:'profitia/SG-dev',ref:'refs/heads/main',workflowRef:'profitia/SG-dev/.github/workflows/platform-contracts-ci.yml@refs/heads/main',event:'workflow_dispatch',actor:'profitia',triggeringActor:'profitia',controlSha:base}
const pr=()=>({number:999,state:'open',changed_files:7,base:{ref:'main',sha:base,repo:{full_name:'profitia/SG-dev'}},head:{ref:review.branch,sha:review.sourceSha,repo:{full_name:'profitia/SG-dev'}},user:{login:'profitia'}})
const select=(p=pr(),f=files(),sha=review.sourceSha,c=context)=>selectCandidate(c,p,sha,{files:f,repositoryRoot:root})

test('only the exact Platform Knowledge seven-file G1 candidate is admitted',()=>{
 assert.equal(select(),review.sourceSha)
 const actual=execFileSync('git',['diff','--name-only',base+'...'+review.sourceSha],{cwd:root,encoding:'utf8'}).trim().split('\n').sort()
 assert.deepEqual(actual,files().map(f=>f.filename).sort())
 for(const f of files())assert.equal(execFileSync('git',['ls-tree',review.sourceSha,'--',f.filename],{cwd:root,encoding:'utf8'}),`100644 blob ${f.sha}\t${f.filename}\n`)
})

test('changed blobs, missing/extra/duplicate files and rename/status changes are refused',()=>{
 const variants=[]
 const changed=files();changed[0].sha='a'.repeat(40);variants.push(changed)
 variants.push(files().slice(1),[...files(),{filename:'Canon/unapproved.md',sha:'a'.repeat(40),status:'added'}])
 const duplicate=files();duplicate[0]=duplicate[1];variants.push(duplicate)
 for(const status of ['removed','renamed','copied','modified']){const a=files();a[0].status=status;variants.push(a)}
 const rename=files();rename[0].previous_filename='Canon/original.md';variants.push(rename)
 for(const f of variants)assert.throws(()=>select(pr(),f),/PLATFORM_KNOWLEDGE_G1_REVIEW_IDENTITY_REJECTED/)
})

test('another PR, branch, author, fork, closed request, HEAD or expected SHA cannot reuse admission',()=>{
 const variants=[]
 for(const mutate of [p=>p.number=1000,p=>p.head.ref='architecture/other',p=>p.user.login='other',p=>p.head.repo.full_name='other/SG-dev',p=>p.state='closed',p=>p.head.sha='b'.repeat(40)]){const p=pr();mutate(p);variants.push(p)}
 for(const p of variants)assert.throws(()=>select(p))
 assert.throws(()=>select(pr(),files(),'b'.repeat(40)))
 for(const c of [{...context,ref:'refs/heads/other'},{...context,event:'pull_request'},{...context,triggeringActor:'other'}])assert.throws(()=>select(pr(),files(),review.sourceSha,c))
})

test('actual checkout bytes and symlink protection remain enforced without executing candidate code',t=>{
 const tmp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'pk-exact-ci-')))
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}))
 execFileSync('git',['init','--quiet'],{cwd:tmp})
 const objects=execFileSync('git',['rev-parse','--git-path','objects'],{cwd:root,encoding:'utf8'}).trim()
 fs.writeFileSync(path.join(tmp,'.git/objects/info/alternates'),path.resolve(root,objects)+'\n')
 for(const f of files()){
  const destination=path.join(tmp,f.filename);fs.mkdirSync(path.dirname(destination),{recursive:true})
  fs.writeFileSync(destination,execFileSync('git',['show',review.sourceSha+':'+f.filename],{cwd:root}))
 }
 const admission={kind:'ARCHITECTURE',baseSha:base,files:files()}
 assert.doesNotThrow(()=>assertArchitectureCheckout(tmp,review.sourceSha,admission,root))
 const first=path.join(tmp,files()[0].filename),original=fs.readFileSync(first)
 fs.writeFileSync(first,Buffer.concat([original,Buffer.from('\nchanged')]))
 assert.throws(()=>assertArchitectureCheckout(tmp,review.sourceSha,admission,root),/ARCHITECTURE_CHECKOUT_REJECTED/)
 fs.rmSync(first);const target=path.join(tmp,'outside-source.txt');fs.writeFileSync(target,original);fs.symlinkSync(target,first)
 assert.throws(()=>assertArchitectureCheckout(tmp,review.sourceSha,admission,root),/ARCHITECTURE_CHECKOUT_REJECTED/)
})

test('private package names and local dependency authority are not expanded',()=>{
 assert.deepEqual(PRIVATE_PACKAGES,['@profitia/advisory-widget','@profitia/cic-core','@profitia/cic-procurement'])
 assert(!Object.keys(LOCAL_PACKAGES).some(n=>n.includes('platform-knowledge')))
 const source=fs.readFileSync(path.join(root,'scripts/governance/controlled-package-ci.mjs'),'utf8')
 assert(source.includes("Object.freeze(['sg2/', 'srm/', 'architecture/'])"))
 assert(source.includes("['100644', '100755']"))
 assert(source.includes('PLATFORM_KNOWLEDGE_G1_FILE_MODE_REJECTED'))
})
