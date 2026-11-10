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
 const consumer=assistantM2Predecessor(current,historical);assert(consumer,'Exact M2 consumer manifest required')
 const producer=srmAssistantM2Predecessor(consumer.previousBytes,historical);assert(producer,'Exact SRM producer manifest required')
 const bytes=producer.previousBytes(relative)
 return encoding?bytes.toString(encoding):bytes
}
