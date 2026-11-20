import {sdkContinuationPredecessor} from '../../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs'
import {createHash} from 'node:crypto'
// Historical checksum view only. Browser bundlers still compile current files.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {assistantM2Predecessor} from './assistant-m2-integrity.mjs'
import {srmAssistantM2Predecessor} from '../../srm/scripts/assistant-m2-integrity.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url)),cache=new Map()
const current=p=>fs.readFileSync(path.join(root,p))
const historical=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}));return Buffer.from(cache.get(key))}
function sourceInput(input){
 const absolute=input instanceof URL?fileURLToPath(input):path.resolve(input),relative=path.relative(root,absolute).split(path.sep).join('/')
 assert(relative&&!relative.startsWith('../')&&!path.isAbsolute(relative),'Source must stay inside the repository')
 return {absolute,relative}
}
// Authenticate the complete current graph once for one checksum assertion.
// Callers create a new reader for a new assertion; there is no current-source cache.
export function createM2AcceptedSourceReader(){
 const receipt=JSON.parse(current('apps/sg-runtime/operation-integration.json'))
 const sdk=sdkContinuationPredecessor(receipt,current,historical,{projectKey:'SG2'})
 const consumer=assistantM2Predecessor(sdk?sdk.previousBytes:current,historical);assert(consumer,'Exact M2 consumer manifest required')
 const producer=srmAssistantM2Predecessor(consumer.previousBytes,historical);assert(producer,'Exact SRM producer manifest required')
 return function readAcceptedSource(input,encoding){
  const {absolute,relative}=sourceInput(input)
  let repositoryPath=relative
  const marker='/node_modules/@profitia/platform-contracts/',installed=relative.lastIndexOf(marker)
  if(sdk&&installed>=0){
   assert(relative.startsWith('apps/sg-runtime/'),'Installed SDK belongs to the SG2 source view')
   repositoryPath='packages/platform-contracts/'+relative.slice(installed+marker.length)
   const expected=(sdk.currentSourceDigests??sdk.record.sourceDigests)[repositoryPath]
   assert(expected,'Installed SDK file is in the verified current source graph')
   assert.equal(createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'),expected,'Actual installed SDK source must match the verified current graph')
  }
  const bytes=producer.previousBytes(repositoryPath)
  return encoding?bytes.toString(encoding):bytes
 }
}

export function readM2AcceptedSource(input,encoding){
 sourceInput(input)
 return createM2AcceptedSourceReader()(input,encoding)
}
