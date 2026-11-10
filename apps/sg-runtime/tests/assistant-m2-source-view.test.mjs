import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {readM2AcceptedSource} from './assistant-m2-source-view.mjs'
test('verified historical checksums preserve both owners while the actual browser source remains current',()=>{
 const root=new URL('../../../',import.meta.url),file='packages/srm-xray/src/financial-scanner.tsx'
 const expected=execFileSync('git',['show','c3b399b13241ae2f4ea8c1b3ae0168fe9a6aac7f:'+file],{cwd:root})
 assert.deepEqual(readM2AcceptedSource(new URL(file,root)),expected)
 assert.notDeepEqual(readFileSync(new URL(file,root)),expected,'Current source is never replaced for browser compilation')
 assert.throws(()=>readM2AcceptedSource(new URL('../../outside',root)))
})
