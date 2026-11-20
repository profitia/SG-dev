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

test('production Node instrumentation and routes retain native SDK migration URLs', { timeout: 240000 }, async () => {
  const { mkdtemp, mkdir, writeFile, symlink, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { spawnSync } = await import('node:child_process')
  const { createHash } = await import('node:crypto')
  const { pathToFileURL, fileURLToPath } = await import('node:url')
  const fixture = await mkdtemp(path.join(tmpdir(), 'sg2-native-sdk-packaging-'))
  const nodeModules = path.join(runtimeRoot, 'node_modules')
  const configUrl = pathToFileURL(path.join(runtimeRoot, 'next.config.mjs')).href
  const environment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
  Object.assign(environment, { CI: '1', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', NEXT_RUNTIME: 'nodejs' })
  const schemaNames = ['organisationContext', 'organisationSelection']
  const native = await import('@profitia/platform-contracts/organisation-context')
  const expected = Object.fromEntries(schemaNames.map(name => {
    const url = native[name + 'SchemaUrl']
    assert.equal(new URL(url).protocol, 'file:')
    return [name, { url, digest: createHash('sha256').update(readFileSync(fileURLToPath(url))).digest('hex') }]
  }))
  let passed = false
  try {
    await symlink(nodeModules, path.join(fixture, 'node_modules'), 'dir')
    await mkdir(path.join(fixture, 'app', 'api', 'schema'), { recursive: true })
    await mkdir(path.join(fixture, 'i18n'))
    await writeFile(path.join(fixture, 'package.json'), JSON.stringify({ name: 'native-sdk-build-regression', private: true }))
    await writeFile(path.join(fixture, 'next.config.mjs'), 'import config from ' + JSON.stringify(configUrl) + ';\nexport default {...config, experimental: {...config.experimental, cpus: 1}};\n')
    await writeFile(path.join(fixture, 'i18n', 'request.ts'), "export default async function request(){return {locale:'pl',messages:{}}}\n")
    await writeFile(path.join(fixture, 'app', 'layout.jsx'), 'export default function Layout({children}){return <html><body>{children}</body></html>}\n')
    await writeFile(path.join(fixture, 'app', 'page.jsx'), 'export default function Page(){return <main>Native SDK packaging regression</main>}\n')
    const imports = "import {organisationContextSchemaUrl,organisationContextSchemaDigest,organisationSelectionSchemaUrl,organisationSelectionSchemaDigest} from '@profitia/platform-contracts/organisation-context';\n"
    const value = '{organisationContext:{url:organisationContextSchemaUrl,digest:organisationContextSchemaDigest()},organisationSelection:{url:organisationSelectionSchemaUrl,digest:organisationSelectionSchemaDigest()}}'
    await writeFile(path.join(fixture, 'instrumentation.js'), 'export async function register(){if(process.env.NEXT_RUNTIME==="nodejs"){const {organisationContextSchemaUrl,organisationContextSchemaDigest,organisationSelectionSchemaUrl,organisationSelectionSchemaDigest}=await import("@profitia/platform-contracts/organisation-context");return ' + value + '}}\n')
    await writeFile(path.join(fixture, 'app', 'api', 'schema', 'route.js'), imports + 'export const runtime="nodejs";\nexport function GET(){return Response.json(' + value + ')}\n')
    const nextBin = path.join(nodeModules, 'next', 'dist', 'bin', 'next')
    const build = spawnSync(process.execPath, [nextBin, 'build', fixture], { cwd: fixture, env: environment, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 })
    assert.equal(build.error, undefined, 'Production build must finish: ' + build.error?.message)
    assert.equal(build.status, 0, 'Production fixture must build with the real SG2 configuration:\n' + build.stdout + build.stderr)
    const compiled = path.join(fixture, '.next', 'server', 'instrumentation.js')
    const execute = spawnSync(process.execPath, ['-e', 'Promise.resolve(require(process.argv[1]).register()).then(value=>process.stdout.write(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1})', compiled], { cwd: fixture, env: environment, encoding: 'utf8', timeout: 15000 })
    assert.equal(execute.error, undefined)
    assert.equal(execute.status, 0, 'Built instrumentation must load the native SDK in Node:\n' + execute.stderr)
    assert.deepEqual(JSON.parse(execute.stdout), expected)
    const route = JSON.parse(readFileSync(path.join(fixture, '.next', 'server', 'app', 'api', 'schema.body'), 'utf8'))
    assert.deepEqual(route, expected, 'The built Node route must retain the same file URLs and migration bytes')
    passed = true
  } finally {
    if (passed) await rm(fixture, { recursive: true, force: true })
    else console.error('Preserved failed public build fixture: ' + fixture)
  }
})
