import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const runtimeRoot = path.resolve(import.meta.dirname, '..')
const tsconfigPath = path.join(runtimeRoot, 'tsconfig.json')
const nextConfigPath = path.join(runtimeRoot, 'next.config.mjs')

test('sg-runtime keeps the @ alias contract portable', async () => {
  const raw = readFileSync(tsconfigPath, 'utf8')
  const tsconfig = JSON.parse(raw) as {
    compilerOptions?: {
      paths?: Record<string, string[]>
    }
  }
  const imported = await import(pathToFileURL(nextConfigPath).href)
  const runtimeAliasWebpack = imported.runtimeAliasWebpack as (config: {
    resolve?: { alias?: Record<string, string> }
  }) => {
    resolve?: { alias?: Record<string, string> }
  }
  const resolvedConfig = runtimeAliasWebpack({ resolve: { alias: {} } })

  assert.deepEqual(tsconfig.compilerOptions?.paths?.['@/*'], ['./*'])
  assert.equal(typeof runtimeAliasWebpack, 'function')
  assert.equal(resolvedConfig?.resolve?.alias?.['@'], runtimeRoot)
})