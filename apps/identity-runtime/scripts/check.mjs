import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process'
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));assert.equal(pkg.dependencies['@clerk/backend'],'3.25.0');assert.equal(pkg.dependencies['@profitia/platform-contracts'],'file:../../packages/platform-contracts')
for(const dir of ['scripts','test'])for(const file of fs.readdirSync(dir)){if(!file.endsWith('.mjs'))continue;const r=spawnSync(process.execPath,['--check',path.join(dir,file)],{stdio:'inherit'});assert.equal(r.status,0)}
for(const file of fs.readdirSync('src')){if(!file.endsWith('.ts'))continue;const text=fs.readFileSync('src/'+file,'utf8');assert(!/localStorage|document\.cookie|jwt\.verify|jsonwebtoken|verifyToken\(/.test(text),'No alternate browser/session/JWT authority')}
console.log('PASS: pinned SDK, syntax and prohibited session-authority checks; typecheck/tests provide behavioral acceptance')
