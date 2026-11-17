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
const historical=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root}));return Buffer.from(cache.get(key))}
export function readM2AcceptedSource(input,encoding){
 const absolute=input instanceof URL?fileURLToPath(input):path.resolve(input),relative=path.relative(root,absolute).split(path.sep).join('/')
 assert(relative&&!relative.startsWith('../')&&!path.isAbsolute(relative),'Source must stay inside the repository')
 const receipt=JSON.parse(current('apps/sg-runtime/operation-integration.json'))
 const sdk=sdkContinuationPredecessor(receipt,current,historical,{projectKey:'SG2'})
 let repositoryPath=relative
 const marker='/node_modules/@profitia/platform-contracts/',installed=relative.lastIndexOf(marker)
 if(sdk&&installed>=0){
  assert(relative.startsWith('apps/sg-runtime/'),'Installed SDK belongs to the SG2 source view')
  repositoryPath='packages/platform-contracts/'+relative.slice(installed+marker.length)
  const expected=sdk.record.sourceDigests[repositoryPath]
  assert(expected,'Installed SDK file is in the verified current source graph')
  assert.equal(createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'),expected,'Actual installed SDK source must match the verified current graph')
 }
 const consumer=assistantM2Predecessor(sdk?sdk.previousBytes:current,historical);assert(consumer,'Exact M2 consumer manifest required')
 const producer=srmAssistantM2Predecessor(consumer.previousBytes,historical);assert(producer,'Exact SRM producer manifest required')
 const bytes=producer.previousBytes(repositoryPath)
 return encoding?bytes.toString(encoding):bytes
}
