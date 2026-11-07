// Public optional-family loader. No credentials, registry, scripts or CI change.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const root=fileURLToPath(new URL('../../../packages/platform-contracts/root-atomic-claim/',import.meta.url))
const config=fs.mkdtempSync(path.join(os.tmpdir(),'root-claim-public-loader-'))
const env=Object.fromEntries(['PATH','HOME','TMPDIR','SystemRoot'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
try{
 fs.writeFileSync(path.join(config,'user.npmrc'),'');fs.writeFileSync(path.join(config,'global.npmrc'),'')
 for(const cwd of [path.resolve(root,'../current-fresh-report'),path.resolve(root,'../readonly-miss-report'),root])execFileSync('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund',
  '--userconfig',path.join(config,'user.npmrc'),'--globalconfig',path.join(config,'global.npmrc'),'--cache',path.join(config,'cache')],{cwd,env,stdio:['ignore','pipe','pipe']})
}finally{fs.rmSync(config,{recursive:true,force:true})}
await import('../../../packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs')
await import('../../../packages/platform-contracts/root-atomic-claim/test/root-atomic-claim-postgres.test.mjs')
await import('../../../packages/platform-contracts/root-atomic-claim/test/root-atomic-claim-types.test.mjs')
