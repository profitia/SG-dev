import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {prepareD1Consumer} from './d1-reader.mjs'

const receipt=JSON.parse(await fs.readFile(new URL('./adoption.json',import.meta.url),'utf8'))
// Full-history CI can use the producer's exact git object. No network, live credentials or providers.
const root=fileURLToPath(new URL('../../../../',import.meta.url))
const starts={H1:'2026-11-02T16:59:07.000000Z',H2:'2026-11-02T17:10:02.000000Z',H3:'2026-11-02T17:10:51.000000Z',H4:'2026-11-02T17:13:46.000000Z',C1:'2026-11-03T04:22:44.000000Z'}
function fixture(producerCheckout,{badRole=false,sourceFails=false,auditFails=false,overflow=false}={}) {
 const commands=[]
 const client=store=>({query:async(q,values)=>{
  const text=typeof q==='string'?q:q.text;commands.push([store,text])
  if(text.startsWith('SELECT current_user'))return{rows:[{role:badRole?'owner':`sg2_d1_${store}_denial_reader`,login:`sg2_d1_${store}_denial_reader`,database:store==='private'?'platform_private':'neondb'}]}
  if(typeof q==='string')return{rows:[]}
  if(store==='source'&&sourceFails)throw Error('SYNTHETIC_SECRET')
  if(store==='source'&&overflow)throw Object.assign(Error('D1_OVERFLOW'),{code:'54000'})
  assert.equal(q.query_timeout,7000);const c=q.values[0]
  const old='srv-dapa3tid0e5s73f8bc5g:35c9284856bb9be5771f6381046ffbffaf39a9f6',current='srv-dapa3tid0e5s73f8bc5g:b4023cb02e10fc7045f8b2bc173224ae3da3cb5a'
  return{rows:[{result:{caseId:c,store,rows:[{caseId:c,store,recorded_at:starts[c],application_id:store==='private'?'spendguru':'spendguru-benchmark-source',deploymentId:c==='C1'?current:old,operation:store==='private'?'benchmark.discovery.request':'knowledge.ingest',phase:'DECISION',decision:'DENY',reasonCode:'POLICY_UNAVAILABLE',event_count:1,firstCheckpoint:'NOT_RECORDED',correlationEvidence:'WINDOW_ONLY'}],invocationRef:randomUUID()}}]}
 }})
 return{commands,config:{producerCheckout,environment:'development',privateClient:client('private'),sourceClient:client('source'),now:Date.now,audit:{begin:async()=>({durable:true,authorizationRef:randomUUID(),expiresAt:new Date(Date.now()+60000).toISOString()}),complete:async v=>({durable:!auditFails,outputSha256:v.outputSha256}),failure:async()=>{}}}}
}
test('SG2 D1 exact producer, read-only transactions, separate roles and mandatory audit; no runtime import',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sg2-d1-consumer-fixture-'))
 try{
  // A synthetic local checkout of the exact producer, never a mutable branch or network fetch.
  execFileSync('git',['worktree','add','--detach',dir,receipt.producerSourceSha],{cwd:root,stdio:'ignore'})
  await t.test('allfivecases and both stores under read-only transaction deadlines',async()=>{
   const f=fixture(dir);const read=await prepareD1Consumer(f.config);const result=await read.read();assert.equal(result.rows.length,10)
   assert.equal(f.commands.filter(([,q])=>q==='BEGIN READ ONLY').length,10);assert.equal(f.commands.filter(([,q])=>q==='COMMIT').length,10)
  })
  await t.test('wrong environment, runtime/owner role, missing Source and audit failure release no results',async()=>{
   const f=fixture(dir);await assert.rejects(prepareD1Consumer({...f.config,environment:'production'}),/SG2_D1_UNAVAILABLE/)
   for(const option of [{badRole:true},{sourceFails:true},{auditFails:true}]){const v=fixture(dir,option);const read=await prepareD1Consumer(v.config);await assert.rejects(read.read(),e=>e.message==='D1_READ_UNAVAILABLE')}
  })
  await t.test('no arbitrarycase or clienttimefilter accepted',async()=>{const f=fixture(dir),read=await prepareD1Consumer(f.config);await assert.rejects(read.read({caseId:'H5'}),/D1_INPUT_REJECTED/);assert.equal(f.commands.length,0)})
  await t.test('SQL overflow retains only the safe technical status and rolls back',async()=>{const f=fixture(dir,{overflow:true}),read=await prepareD1Consumer(f.config);await assert.rejects(read.read(),e=>e.message==='D1_OVERFLOW');assert(f.commands.some(([,q])=>q==='ROLLBACK'))})
  await t.test('tampered producer bytes rejected before any connection/SQL',async()=>{
   await fs.appendFile(path.join(dir,receipt.modulePath),'\n// synthetic tamper\n');const f=fixture(dir);await assert.rejects(prepareD1Consumer(f.config),/SG2_D1_UNAVAILABLE/);assert.equal(f.commands.length,0)
  })
 }finally{execFileSync('git',['worktree','remove','--force',dir],{cwd:root,stdio:'ignore'})}
})
