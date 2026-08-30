import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const runtimeRoot = path.resolve(testDir, '..')
const packageJsonPath = path.join(runtimeRoot, 'package.json')
const buildScriptPath = path.resolve(runtimeRoot, '..', '..', 'scripts', 'build-sg-runtime-private-service.sh')

test('repo-root build script keeps sg-runtime devDependencies available during production builds', () => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  const buildScript = readFileSync(buildScriptPath, 'utf8')

  assert.ok(packageJson.devDependencies?.typescript, 'Expected TypeScript to remain a devDependency for SG Runtime builds.')
  assert.match(
    buildScript,
    /npm install --include=dev/,
    'Expected the repo-root build script to install SG Runtime devDependencies during production builds.',
  )
})