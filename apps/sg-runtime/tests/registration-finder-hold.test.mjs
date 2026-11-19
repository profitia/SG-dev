// Registration release boundary: preserve the explicitly held Finder runtime.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
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
 if(!entry){assert.equal(fs.existsSync(path.join(root,name)),false);return}
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
