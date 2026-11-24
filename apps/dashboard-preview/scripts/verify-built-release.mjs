import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'

const service = 'srv-dapa3ujm8hqs73a9t2og'
const schema = 'sg2-dashboard-release-build/v1'
const build = '.next'
const receiptName = 'sg2-release-build.json'
const receiptPath = join(build, receiptName)
const excluded = new Set(['cache', 'trace', receiptName])
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

function readRegularFile(path) {
  assert(lstatSync(path).isFile(), 'UNEXPECTED_FILE_TYPE: ' + path)
  return readFileSync(path)
}

function identity() {
  const source = process.env.RENDER_GIT_COMMIT
  assert.match(source ?? '', /^[a-f0-9]{40}$/, 'RENDER_SOURCE_REQUIRED')
  assert.equal(process.env.RENDER_SERVICE_ID, service, 'UNEXPECTED_RENDER_SERVICE')
  assert.equal(process.env.RENDER_GIT_REPO_SLUG?.toLowerCase(), 'profitia/sg-dev', 'UNEXPECTED_RENDER_REPOSITORY')
  return { source, service }
}

function snapshot() {
  assert(lstatSync(build).isDirectory(), 'UNEXPECTED_BUILD_DIRECTORY')
  const buildId = readRegularFile(join(build, 'BUILD_ID'))
  assert(buildId.length > 0, 'EMPTY_BUILD_ID')
  const files = []
  function walk(path) {
    const stat = lstatSync(path)
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) walk(join(path, name))
      return
    }
    assert(stat.isFile(), 'UNEXPECTED_BUILD_FILE: ' + path)
    files.push([path, sha256(readFileSync(path))])
  }
  for (const name of readdirSync(build).sort()) {
    if (!excluded.has(name)) walk(join(build, name))
  }
  assert(files.some(([file]) => file.startsWith(join(build, 'server') + '/')), 'SERVER_BUILD_MISSING')
  return {
    artifactSha256: sha256(JSON.stringify(files)),
    files: files.length,
    buildIdSha256: sha256(buildId),
    lockfileSha256: sha256(readRegularFile('package-lock.json')),
  }
}

async function availablePort() {
  const probe = createServer()
  return await new Promise((done, fail) => {
    probe.once('error', fail)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(error => error ? fail(error) : done(port))
    })
  })
}

async function smoke() {
  for (const filename of ['.env', '.env.production', '.env.local', '.env.production.local']) {
    assert(!lstatSync(filename, { throwIfNoEntry: false }), 'UNEXPECTED_SMOKE_ENV_FILE: ' + filename)
  }
  const port = await availablePort()
  const origin = 'http://127.0.0.1:' + port
  const server = spawn(process.execPath, [
    resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port),
  ], {
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      PROFITIA_AUTH_PROVIDER: 'clerk',
      TARGET_ENVIRONMENT: 'development',
      APP_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  let ready = false
  let startupError
  let recentOutput = ''
  server.stdout.setEncoding('utf8')
  server.stdout.on('data', chunk => {
    recentOutput = (recentOutput + chunk).slice(-512)
    if (/Ready in\s/i.test(recentOutput)) ready = true
  })
  server.once('error', error => { startupError = error })
  const closed = new Promise(done => server.once('close', done))
  try {
    for (let attempt = 0; !ready && attempt < 150; attempt++) {
      assert(!startupError && server.exitCode === null, 'ISOLATED_START_FAILED')
      await pause(100)
    }
    assert(ready && server.exitCode === null, 'ISOLATED_START_TIMEOUT')
    for (const path of ['/en', '/pl', '/api/records', '/api/series']) {
      const response = await fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
      assert.equal(response.status, 503, 'EXPECTED_REFUSAL: ' + path)
      assert.equal(response.headers.get('cache-control'), 'private, no-store', 'UNSAFE_CACHE: ' + path)
      const vary = new Set(response.headers.get('vary')?.toLowerCase().split(',').map(value => value.trim()))
      assert(vary.has('cookie') && vary.has('authorization'), 'REQUIRED_VARY_MISSING: ' + path)
      assert.equal(response.headers.get('location'), null, 'UNEXPECTED_REDIRECT: ' + path)
      await response.body?.cancel()
    }
  } finally {
    server.kill('SIGTERM')
    await Promise.race([closed, pause(3000, undefined, { ref: false })])
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL')
    await closed
  }
}

try {
  const inputs = identity()
  const mode = process.argv[2]
  if (mode === 'seal') {
    const before = snapshot()
    await smoke()
    assert.deepEqual(snapshot(), before, 'ARTIFACT_CHANGED_DURING_SMOKE')
    const receipt = { schema, ...inputs, ...before, smoke: 'PASS', routes: 4 }
    writeFileSync(receiptPath, JSON.stringify(receipt) + '\n', { flag: 'wx', mode: 0o644 })
    console.log('SG2_RELEASE_BUILD_SEALED', JSON.stringify(receipt))
  } else {
    assert.equal(mode, 'verify', 'SPECIFY_SEAL_OR_VERIFY')
    const receipt = JSON.parse(readRegularFile(receiptPath).toString('utf8'))
    assert.deepEqual(receipt, { schema, ...inputs, ...snapshot(), smoke: 'PASS', routes: 4 }, 'ARTIFACT_HANDOFF_MISMATCH')
    console.log('SG2_RELEASE_BUILD_VERIFIED', JSON.stringify(receipt))
  }
} catch (error) {
  console.error('SG2_RELEASE_BUILD_REJECTED', error.code === 'ENOENT' ? 'BUILD_INPUT_MISSING' : String(error.message).split('\n')[0])
  process.exitCode = 1
}
