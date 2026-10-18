import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
test('public native transport types compile positive and expected-negative consumer contracts',()=>{
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../../../apps/architecture-lab/node_modules/typescript/bin/tsc',import.meta.url)),'--project',fileURLToPath(new URL('./types/tsconfig.json',import.meta.url))],{encoding:'utf8'})
 assert.equal(result.status,0,result.stdout+result.stderr)
})
