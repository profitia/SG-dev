import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'

test('packed optional capture uses one unchanged SDK1.32.3 and strict readonly public types',async()=>{
 const pkg=fileURLToPath(new URL('../',import.meta.url)),sdk=fileURLToPath(new URL('../../',import.meta.url)),root=fileURLToPath(new URL('../../../../',import.meta.url))
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'architecture-payload-public-'))
 try{
  assert.equal(JSON.parse(fs.readFileSync(path.join(sdk,'package.json'))).version,'1.32.3')
  const packed=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',temp],{cwd:pkg,encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0]
  execFileSync('tar',['-xzf',path.join(temp,packed.filename),'-C',temp])
  const modules=path.join(temp,'node_modules/@profitia');fs.mkdirSync(modules,{recursive:true})
  fs.symlinkSync(sdk,path.join(modules,'platform-contracts'),'dir')
  fs.symlinkSync(path.join(temp,'package'),path.join(modules,'platform-payload-capture'),'dir')
  const manifest=JSON.parse(fs.readFileSync(path.join(temp,'package/package.json')))
  assert.deepEqual(manifest.peerDependencies,{'@profitia/platform-contracts':'1.32.3'})
  assert.equal(manifest.dependencies,undefined)
  const require=createRequire(path.join(temp,'entry.mjs')),captureRequire=createRequire(path.join(temp,'package/package.json'))
  assert.equal(require.resolve('@profitia/platform-contracts/operation-context'),captureRequire.resolve('@profitia/platform-contracts/operation-context'))
  const imported=await import(pathToFileURL(path.join(temp,'package/src/payload-capture.mjs'))),required=require('@profitia/platform-payload-capture')
  assert.equal(imported.captureFinitePayload,required.captureFinitePayload)
  assert.equal(imported.captureFinitePayload({ok:1}).digest,require('@profitia/platform-contracts/operation-context').operationPayloadDigest({ok:1}))
  const file=path.join(temp,'public-api.mts')
  fs.writeFileSync(file,`import {captureFinitePayload,type ReadonlyJson,PAYLOAD_CAPTURE_CONTRACT} from '@profitia/platform-payload-capture';\nconst c=captureFinitePayload({a:[1]}, {maximumBytes:32*1024*1024});\nconst value:ReadonlyJson=c.value;const digest:string=c.digest;const purpose:'DATA_ONLY'=PAYLOAD_CAPTURE_CONTRACT.purpose;\n// @ts-expect-error Immutable result\nc.digest='forged';\n// @ts-expect-error Immutable nested data\n(c.value as readonly ReadonlyJson[]).push(2);\nvoid [value,digest,purpose];\n`)
  const ts=createRequire(path.join(root,'apps/architecture-lab/package.json'))('typescript')
  const program=ts.createProgram([file],{strict:true,noEmit:true,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,target:ts.ScriptTarget.ES2022,skipLibCheck:false})
  const errors=ts.getPreEmitDiagnostics(program)
  assert.equal(errors.length,0,ts.formatDiagnostics(errors,{getCurrentDirectory:()=>temp,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}))
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})
