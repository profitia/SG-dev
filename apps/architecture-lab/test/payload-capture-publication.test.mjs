import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'

// The existing credential-free producer job discovers this adapter. Its public
// dependency installations already provide SDK/lab dependencies. Link one local
// SDK peer, then execute the actual package tests in this Node test process.
// No private-package controller, workflow, environment or policy is changed.
const sdk=fileURLToPath(new URL('../../../packages/platform-contracts/',import.meta.url))
const alias=path.join(sdk,'payload-capture/node_modules/@profitia/platform-contracts')
assert.equal(JSON.parse(fs.readFileSync(path.join(sdk,'package.json'))).version,'1.32.3')
fs.mkdirSync(path.dirname(alias),{recursive:true})
if(!fs.existsSync(alias))fs.symlinkSync(sdk,alias,'dir')
assert.equal(fs.realpathSync(alias),fs.realpathSync(sdk),'One actual unchanged SDK peer')

await import('../../../packages/platform-contracts/payload-capture/test/payload-capture.test.mjs')
await import('../../../packages/platform-contracts/payload-capture/test/public-package.test.mjs')
