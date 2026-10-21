import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import {CONTROL_POLICY_FILES} from './controlled-package-ci.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const workflow = '.github/workflows/platform-contracts-ci.yml'
const text = fs.readFileSync(path.join(root, workflow), 'utf8')
const consumers = ['apps/sg-runtime', 'apps/srm', 'apps/dashboard-preview', 'apps/architecture-lab',
  'packages/platform-contracts', 'packages/srm-xray']
const files = execFileSync('git', ['ls-files', '-z', '--', ...consumers], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)

// Read the existing workflow's deliberately simple quoted path-list syntax.
// Unsupported syntax fails this guard rather than silently skipping a filter.
function patternsFor(event) {
  const lines = text.split('\n'), heading = `  ${event}:`
  assert.equal(lines.filter(line => line === heading).length, 1)
  const start = lines.indexOf(heading)
  const next = lines.findIndex((line, index) => index > start && /^  \S/.test(line))
  const block = lines.slice(start + 1, next < 0 ? undefined : next)
  const offset = block.indexOf('    paths:')
  assert(offset >= 0, `${event} must declare path filters`)
  const patterns = []
  for (const line of block.slice(offset + 1)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const entry = /^      - '([^']+)'$/.exec(line)
    assert(entry, `Unsupported ${event} path-list syntax: ${line}`)
    const pattern = entry[1]
    assert(/^[A-Za-z0-9._/-]+(?:\/\*\*|\*)?$/.test(pattern), `Unsupported coverage pattern: ${pattern}`)
    patterns.push(pattern)
  }
  assert(patterns.length > 0)
  return patterns
}

// Only the three literal forms used by these filters: exact file, subtree /**
// and a final basename *. In particular * must not match another directory.
function covers(pattern, file) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3)
    return file === prefix || file.startsWith(`${prefix}/`)
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return file.startsWith(prefix) && !file.slice(prefix.length).includes('/')
  }
  return pattern === file
}
const events = ['pull_request', 'push']
for (const event of events) {
  test(`${event} covers every tracked current consumer and reused shared-module file`, t => {
    const patterns = patternsFor(event)
    for (const consumer of consumers) assert(files.some(file => file.startsWith(`${consumer}/`)), `Missing actual consumer: ${consumer}`)
    const missing = files.filter(file => !patterns.some(pattern => covers(pattern, file)))
    t.diagnostic(`Examined ${files.length} tracked files across ${consumers.length} actual consumer/module trees`)
    const critical = ['apps/sg-runtime/lib/market-data/stored-read.ts', 'apps/sg-runtime/tests/stored-market-read.integration.test.mjs',
      'apps/sg-runtime/lib/platform/private-runtime.ts', 'apps/sg-runtime/prisma-market-data/private-read/002-stored-rolling-current.sql']
      .filter(file => !patterns.some(pattern => covers(pattern, file)))
    assert.equal(missing.length, 0, `Missing protected source coverage: ${critical.join(', ')}; ${missing.length} omissions, first: ${missing.slice(0, 20).join(', ')}`)
  })
}

test('product integration does not expand into unrelated apps, evidence or similarly named roots', () => {
  for (const event of events) for (const file of ['apps/pmos/package.json', 'apps/pcos-explorer/package.json',
    'apps/vector/package.json', 'Canon/evidence/unrelated-fixture.md', 'README.md', 'apps/sg-runtime-unrelated/package.json',
    'apps/srm-unrelated/package.json', 'scripts/governance/controlled-package-ci-private/nested.mjs']) {
    assert(!patternsFor(event).some(pattern => covers(pattern, file)), `Unrelated ${file} unexpectedly triggers ${event}`)
  }
})

test('both events cover the workflow, its guard/controller and registry inputs while push stays on main', () => {
  const self = path.relative(root, fileURLToPath(import.meta.url)).split(path.sep).join('/')
  for (const event of events) for (const file of [workflow, self, 'scripts/governance/controlled-package-ci.mjs',
    'scripts/governance/controlled-package-ci.test.mjs', 'Canon/registries/development-workspaces-v1.json', 'Canon/registries/profitia-projects-v1.json',
    'Canon/registries/architecture-environment-topology-v1.json']) {
    assert(patternsFor(event).some(pattern => covers(pattern, file)), `Control source ${file} omitted from ${event}`)
  }
  assert.deepEqual(patternsFor('pull_request'), patternsFor('push'))
  assert.match(text, /\n  push:\n    branches: \[main\]\n/)
})

test('both events cover every trusted transitive admission and fingerprint input', () => {
  for (const event of events) for (const file of CONTROL_POLICY_FILES) {
    assert(patternsFor(event).some(pattern => covers(pattern, file)), `Trusted admission input ${file} omitted from ${event}`)
  }
})
