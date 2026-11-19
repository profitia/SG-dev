/** Runs the canonical native Root/receiver suite, including schema constraints.
 * The retired login-mapping fixture could not install the sealed v1 schema.
 * No substitute scope helper or optional environment switch is used here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile);
test('supplier schema and HTTP integration use the genuine canonical native receiver',async()=>{
 const result=await run(process.execPath,['--import','tsx','--test','--test-reporter=tap',fileURLToPath(new URL('../../../scripts/supplier-pipelines-postgres.test.mjs',import.meta.url))],{
  // Start an independent native runner instead of inheriting Node's parent-test IPC mode.
  env:Object.fromEntries(Object.entries(process.env).filter(([key])=>key!=='NODE_TEST_CONTEXT')),
  cwd:fileURLToPath(new URL('../../../',import.meta.url)),timeout:120000,maxBuffer:4*1024*1024,
 });
 assert.match(result.stdout,/(?:#|ℹ) fail 0/);
 assert.match(result.stdout,/(?:#|ℹ) skipped 0/);
 console.log(result.stdout);
});
