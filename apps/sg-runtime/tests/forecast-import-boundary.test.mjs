import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// Each import runs in a fresh process: imports already cached by a test runner
// cannot hide constructors which resolve a global client during module loading.
const imports = [
  'lib/forecast/service.ts',
  'lib/forecast/source-worker.ts',
  'lib/forecast/source-worker-runtime.ts',
  'lib/forecast/source-worker-science.ts',
  'lib/forecast/stored-current-read.ts',
  'lib/forecast/stored-verification-read.ts',
  'lib/forecast/verification-operation-handlers.ts',
  'lib/forecast/rolling-daily-verification.ts',
  'lib/platform/private-runtime.ts',
  'app/api/benchmark/forecast/current/route.ts',
  'app/api/benchmark/forecast/verification/route.ts',
]
const script = `
  let globalResolutions=0,externalRequests=0;
  Object.defineProperty(globalThis,'__sgRuntimeMarketDataPrisma__',{
    configurable:true,get(){globalResolutions++;throw Error('IMPORT_GLOBAL_CLIENT_ACCESS')}
  });
  globalThis.fetch=async()=>{externalRequests++;throw Error('IMPORT_EXTERNAL_ACCESS')};
  try {
    await import(process.argv[1]);
    if(globalResolutions||externalRequests)throw Error('Import resolved an execution resource');
    console.log(JSON.stringify({globalResolutions,externalRequests}));
  } catch(error) {
    console.error(JSON.stringify({globalResolutions,externalRequests,reason:error.message}));
    process.exitCode=1;
  }
`
for (const target of imports) test(`fresh import of ${target} resolves no legacy client or external transport`, () => {
  const result = spawnSync(process.execPath,['--import','tsx','--input-type=module','--eval',script,new URL(`../${target}`,import.meta.url).href],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),
    env:{...process.env,MARKET_DATA_DATABASE_URL:'postgresql://architecture_test_owner@127.0.0.1:1/sg2_operation_test'},
    encoding:'utf8',timeout:20000,
  })
  assert.equal(result.status,0,result.stderr || result.stdout)
  assert.deepEqual(JSON.parse(result.stdout.trim()),{globalResolutions:0,externalRequests:0})
})
