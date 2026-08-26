import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PERFORMANCE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const FORECAST_ROOT = path.resolve(PERFORMANCE_ROOT, '..')
const REPOSITORY_ROOT = path.resolve(FORECAST_ROOT, '..', '..')
const OUTPUT_PATH = path.join(FORECAST_ROOT, 'validation', 'phase-2-3', 'functional-regression.json')
const PROHIBITED = /phase-2-1b-baseline|--execute|stress workload/i

const relative = (filePath) => path.relative(REPOSITORY_ROOT, filePath)

async function filesWithSuffix(directory, suffix) {
  return (await readdir(directory)).filter((file) => file.endsWith(suffix)).sort().map((file) => path.join(directory, file))
}

function summarize(output) {
  const nodeTests = output.match(/(?:#|ℹ) tests (\d+)/)
  const nodePass = output.match(/(?:#|ℹ) pass (\d+)/)
  const nodeFail = output.match(/(?:#|ℹ) fail (\d+)/)
  const pythonTests = output.match(/Ran (\d+) tests? in/)
  if (nodeTests) return { tests: Number(nodeTests[1]), passed: Number(nodePass?.[1] ?? 0), failed: Number(nodeFail?.[1] ?? 0) }
  if (pythonTests) return { tests: Number(pythonTests[1]), passed: Number(pythonTests[1]), failed: 0 }
  return { tests: null, passed: null, failed: null }
}

function executeCheck(check) {
  const commandText = [check.command, ...check.args].join(' ')
  assert.equal(PROHIBITED.test(commandText), false, `Prohibited Phase 2.3 regression command: ${commandText}`)
  const startedAt = new Date().toISOString()
  const started = Date.now()
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 512 * 1024 * 1024,
  })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  return {
    id: check.id,
    category: check.category,
    command: commandText,
    cwd: relative(check.cwd),
    startedAt,
    endedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    exitCode: result.status,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    ...summarize(output),
    outputTail: output.split('\n').slice(-30),
  }
}

async function validatePhase23Json() {
  const paths = [
    'tooling/Benchmark-Forecasting/performance/phase-2-3-c01-implementation-evidence.json',
    'tooling/Benchmark-Forecasting/performance/phase-2-3-c01-structural-proof.json',
    'tooling/Benchmark-Forecasting/performance/phase-2-3-p09-lower-control.json',
    'tooling/Benchmark-Forecasting/performance/phase-2-3-p09-high-concurrency.json',
    'tooling/Benchmark-Forecasting/performance/phase-2-3-p10-non-regression.json',
    'tooling/Benchmark-Forecasting/validation/phase-2-3/execution-control/execution-accounting.json',
  ]
  for (const filePath of paths) JSON.parse(await readFile(path.join(REPOSITORY_ROOT, filePath), 'utf8'))
  return { id: 'phase-2-3-json', category: 'JSON_VALIDATION', command: 'JSON.parse Phase 2.3 evidence', cwd: '.', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationMs: 0, exitCode: 0, status: 'PASS', tests: paths.length, passed: paths.length, failed: 0, outputTail: paths }
}

async function checks() {
  const runtimeRoot = path.join(REPOSITORY_ROOT, 'apps', 'sg-runtime')
  const dashboardRoot = path.join(REPOSITORY_ROOT, 'apps', 'dashboard-preview')
  const dataRuntimeRoot = path.join(REPOSITORY_ROOT, 'apps', 'data-runtime')
  return [
    {
      id: 'forecast-core', category: 'FUNCTIONAL_TEST', command: path.join(FORECAST_ROOT, '.venv', 'bin', 'python'),
      args: ['-m', 'unittest', 'discover', '-s', path.join(FORECAST_ROOT, 'tests')], cwd: FORECAST_ROOT,
    },
    {
      id: 'sg-runtime', category: 'FUNCTIONAL_TEST', command: process.execPath,
      args: ['--import', 'tsx', '--test', ...await filesWithSuffix(path.join(runtimeRoot, 'tests'), '.test.ts')], cwd: runtimeRoot,
    },
    { id: 'dashboard-preview', category: 'FUNCTIONAL_TEST', command: 'npm', args: ['test'], cwd: dashboardRoot },
    {
      id: 'phase-tooling', category: 'FUNCTIONAL_TEST', command: process.execPath,
      args: ['--test', ...await filesWithSuffix(PERFORMANCE_ROOT, '.test.mjs')], cwd: REPOSITORY_ROOT,
    },
    { id: 'sg-runtime-typecheck', category: 'TYPECHECK', command: 'npm', args: ['run', 'typecheck'], cwd: runtimeRoot },
    { id: 'dashboard-preview-typecheck', category: 'TYPECHECK', command: 'npm', args: ['run', 'typecheck'], cwd: dashboardRoot },
    { id: 'data-runtime-typecheck', category: 'TYPECHECK', command: 'npm', args: ['run', 'typecheck'], cwd: dataRuntimeRoot },
    { id: 'dashboard-preview-build', category: 'BUILD', command: 'npm', args: ['run', 'build'], cwd: dashboardRoot },
    ...[
      ['phase-2-2b-4r-gate', 'phase-2-2b-4r-final-gate.validator.mjs'],
      ['phase-2-2c-gate', 'phase-2-2c-final-gate.validator.mjs'],
      ['phase-2-2d-gate', 'phase-2-2d-final-gate.validator.mjs'],
    ].map(([id, file]) => ({
      id, category: 'ACCEPTED_GATE_REGRESSION', command: process.execPath,
      args: [path.join(PERFORMANCE_ROOT, file)], cwd: REPOSITORY_ROOT,
    })),
    { id: 'git-diff-check', category: 'SOURCE_HYGIENE', command: 'git', args: ['diff', '--check'], cwd: REPOSITORY_ROOT },
  ]
}

async function run() {
  const results = []
  for (const check of await checks()) results.push(executeCheck(check))
  results.push(await validatePhase23Json())
  const evidence = {
    task: 'FORECAST_PHASE_2_3_FULL_NON_STRESS_REGRESSION',
    generatedAt: new Date().toISOString(),
    stressExecutionPermitted: false,
    stressExecutionObserved: false,
    checksExpected: results.length,
    checksPassed: results.filter(({ status }) => status === 'PASS').length,
    checksFailed: results.filter(({ status }) => status === 'FAIL').length,
    status: results.every(({ status }) => status === 'PASS') ? 'PASS' : 'FAIL',
    results,
  }
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, `${JSON.stringify(evidence, null, 2)}\n`)
  assert.equal(evidence.status, 'PASS', `Regression failed: ${results.filter(({ status }) => status === 'FAIL').map(({ id }) => id).join(', ')}`)
  process.stdout.write(`${JSON.stringify({ phase23FunctionalRegression: evidence.status, checksPassed: evidence.checksPassed, checksExpected: evidence.checksExpected, stressExecutionObserved: false }, null, 2)}\n`)
}

if (process.argv[2] === '--run') {
  run().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`)
    process.exitCode = 1
  })
} else {
  process.stderr.write('Usage: phase-2-3-functional-regression.mjs --run\n')
  process.exitCode = 1
}