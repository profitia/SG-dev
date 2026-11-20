// Registration release boundary: preserve the explicitly held Finder runtime.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const historical=["apps/sg-runtime/tests/benchmark-discovery-unmetered-private.integration.test.mjs", "apps/sg-runtime/tests/benchmark-discovery-unmetered.integration.test.mjs"]
const archivalSource="cd379b56995a6d0dcf81bc274769e27c2d3799e7"
const held=[
 "apps/sg-runtime/deployment/benchmark-discovery-targets.json",
 "apps/sg-runtime/instrumentation.ts",
 "apps/sg-runtime/lib/benchmark/discovery-api.ts",
 "apps/sg-runtime/lib/benchmark/discovery-continuity.ts",
 "apps/sg-runtime/lib/benchmark/discovery-host.ts",
 "apps/sg-runtime/lib/benchmark/discovery-runtime.ts",
 "apps/sg-runtime/lib/benchmark/discovery-source.ts",
 "apps/sg-runtime/lib/benchmark/errors.ts",
 "apps/sg-runtime/lib/benchmark/macrobond.ts",
 "apps/sg-runtime/scripts/verify-finder-development-bindings.mjs",
 "apps/sg-runtime/tests/benchmark-discovery-unmetered-private.integration.test.mjs",
 "apps/sg-runtime/tests/benchmark-discovery-unmetered.integration.test.mjs",
 "apps/sg-runtime/tests/finder-development-bindings.test.mjs"
]
const acceptedMain='78cf4e20a65221b520deaacd773d81c3e94482cd'
for(const name of held)test('held Finder postimage: '+name,()=>{
 const entry=execFileSync('git',['--literal-pathspecs','ls-tree',acceptedMain,'--',name],{cwd:root,encoding:'utf8'}).trim()
 if(!entry){
  if(historical.includes(name)){assert.deepEqual(fs.readFileSync(path.join(root,name)),execFileSync('git',['cat-file','blob',archivalSource+':'+name],{cwd:root}));return}
  assert.equal(name,'apps/sg-runtime/lib/benchmark/discovery-continuity.ts');assert.equal(fs.readFileSync(path.join(root,name),'utf8'),"// Retained physical SDK source inventory. Finder access repair remains on OWNER HOLD.\n// No startup imports this module; no database, provider, timers or renewal exists.\nexport async function startFinderSourceContinuity():Promise<void>{\n throw new Error('FINDER_ACCESS_REPAIR_OWNER_HOLD')\n}\n");return
 }
 assert.match(entry,/^100644 blob [a-f0-9]{40}\t/)
 const actual=fs.readFileSync(path.join(root,name)),expected=execFileSync('git',['cat-file','blob',acceptedMain+':'+name],{cwd:root})
 assert.deepEqual(actual,expected)
})
test('registration keeps per-request organisation guards and excludes Finder renewal startup',()=>{
 const read=name=>fs.readFileSync(path.join(root,name),'utf8')
 assert.match(read('apps/sg-runtime/lib/benchmark/discovery-http.ts'),/bindSg2RequestRuntime/)
 assert.match(read('apps/sg-runtime/lib/platform/private-runtime.ts'),/createSg2OrganisationContextReader/)
 assert.match(read('apps/sg-runtime/lib/platform/private-runtime.ts'),/currentOrganisation/)
 assert.doesNotMatch(read('apps/sg-runtime/instrumentation.ts'),/startFinderSourceContinuity|discovery-continuity/)
 assert.doesNotMatch(read('apps/sg-runtime/lib/benchmark/discovery-runtime.ts'),/034-unmetered|unmeteredSchemaDigest|requiredQuotaMode/)
})

test('retained continuity inventory cannot access a database or run a renewal',()=>{
 const source=fs.readFileSync(path.join(root,'apps/sg-runtime/lib/benchmark/discovery-continuity.ts'),'utf8')
 assert.match(source,/throw new Error\('FINDER_ACCESS_REPAIR_OWNER_HOLD'\)/)
 assert.doesNotMatch(source,/^import |Prisma|setInterval|maintain_source_technical_access|\$queryRaw/m)
 const scan=directory=>{for(const item of fs.readdirSync(directory,{withFileTypes:true})){
  const location=path.join(directory,item.name)
  if(item.isDirectory())scan(location)
  else if(/\.(ts|tsx|mjs)$/.test(item.name)&&location!==path.join(root,'apps/sg-runtime/lib/benchmark/discovery-continuity.ts'))assert.doesNotMatch(fs.readFileSync(location,'utf8'),/discovery-continuity|startFinderSourceContinuity/)
 }}
 scan(path.join(root,'apps/sg-runtime/lib'));scan(path.join(root,'apps/sg-runtime/app'))
})
