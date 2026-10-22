import fs from 'node:fs/promises'
import {parseJson} from '@profitia/krs-registry-contracts'
import {loadConfig} from './config.js'
import {validatePlan} from './sync.js'
import type {SyncPlan} from './sync.js'
loadConfig()
const [command,file,...extra]=process.argv.slice(2)
if(command!=='validate-plan'||!file||extra.length){console.error('Usage: npm run sync -- validate-plan /path/to/approved-finite-plan.json');process.exitCode=1}
else{
  const stat=await fs.stat(file);if(stat.size>8192)throw Error('PLAN_TOO_LARGE')
  const plan=parseJson(await fs.readFile(file,'utf8'),8192) as SyncPlan;validatePlan(plan,Date.now())
  console.log(JSON.stringify({status:'PLAN_VALIDATED',execution:'DISABLED',days:plan.days.length,approvalRef:plan.approvalRef,reason:'ACTIVATION_DEFERRED / E1_PRODUCER_AND_STORAGE_NOT_ACCEPTED'}))
}
