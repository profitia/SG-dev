import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
test('workspace public host types allow the closed API and reject consumer authority overrides',()=>{
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('../../../apps/architecture-lab/node_modules/typescript/bin/tsc',import.meta.url)),
 '--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','--strict','--noEmit','--lib','ES2022,DOM',
 fileURLToPath(new URL('./types/supplier-workspace.mts',import.meta.url))],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
