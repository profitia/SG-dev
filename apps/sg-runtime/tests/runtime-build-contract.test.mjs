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


test('real Node instrumentation starts tenant-free retention, preserves readiness denial and binds later requests independently',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{build}=require('esbuild'),fs=await import('node:fs')
 const target=JSON.parse(fs.readFileSync('deployment/assistant-m1-targets.json','utf8'))
 const privateTarget=JSON.parse(fs.readFileSync('deployment/private-runtime-targets.json','utf8')).environments.development
 const savedFetch=globalThis.fetch;globalThis.fetch=async()=>assert.fail('No model or provider request during startup')
 const state={opened:[],queries:[],denied:false}
 globalThis.__organisationAssistantPrisma=class{
  constructor(options){state.opened.push(options)}
  async $queryRawUnsafe(sql){state.queries.push(sql)
   if(sql.includes('sg2_assistant_history.descriptor()'))return [{binding:{...target.history,applicationId:'spendguru',environment:'development',runtimeRole:state.denied?'wrong_role':target.history.runtimeRole}}]
   if(sql.includes('pg_has_role'))return [{database_name:'neondb',role:target.usage.runtimeRole,login:target.usage.runtimeRole,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolinherit:false,owner_member:false,installed:true,executable:true}]
   if(sql.includes('prune()'))return []
   assert.fail('Unexpected business query during startup')
  }
  async $executeRawUnsafe(){assert.fail('No business write during startup')}
  async $transaction(){assert.fail('No tenant transaction during startup')}
 }
 const saved={NEXT_RUNTIME:process.env.NEXT_RUNTIME,PROFITIA_ASSISTANT_ENABLED:process.env.PROFITIA_ASSISTANT_ENABLED}
 const load=async(entry,plugins=[])=>{
  const output=await build({entryPoints:[path.resolve(entry)],bundle:true,write:false,platform:'node',format:'cjs',alias:{'@':process.cwd()},external:['openai','@clerk/backend','@profitia/platform-contracts/*','@/generated/*','@/lib/forecast/*','@/lib/platform/forecast-current','@/lib/platform/forecast-verification','@/lib/api/middleware','@/lib/insights/subscriptions'],plugins})
  const module={exports:{}};new Function('require','module','exports',output.outputFiles[0].text)(require,module,module.exports);return module.exports
 }
 try{
  const hostSource=fs.readFileSync('lib/platform/private-host.ts','utf8')
  const hosts=[...hostSource.matchAll(/export (?:async )?function (create\w+)/g)].map(m=>m[1])
  const fixture={name:'startup-independent-boundaries',setup(b){
   b.onResolve({filter:/.*/},args=>args.kind==='dynamic-import'&&args.path!=='@/lib/assistant/runtime'?{path:args.path,external:true}:undefined)
   b.onResolve({filter:/^@prisma\/client$/},()=>({path:'prisma',namespace:'startup-fixture'}))
   b.onResolve({filter:/^\.\/private-host$/},()=>({path:'hosts',namespace:'startup-fixture'}))
   b.onResolve({filter:/^@\/lib\/benchmark\/discovery-runtime$/},()=>({path:'discovery',namespace:'startup-fixture'}))
   b.onResolve({filter:/^@\/lib\/market-data\/stored-read$/},()=>({path:'market',namespace:'startup-fixture'}))
   b.onResolve({filter:/^@\/lib\/forecast\/delegated-delivery$/},()=>({path:'forecast',namespace:'startup-fixture'}))
   b.onLoad({filter:/.*/,namespace:'startup-fixture'},args=>({contents:{
    prisma:'export const PrismaClient=globalThis.__organisationAssistantPrisma',
    discovery:'export function readDiscoveryConfiguration(){return null};export function createDiscoveryRuntime(){throw Error("No discovery startup")}',
    market:'export function createStoredMarketHistoryReader(){throw Error("No market startup")}',
    forecast:'export function createSg2ForecastDispatchPersister(){throw Error("No forecast startup")}',
    hosts:hosts.map(name=>'export function '+name+'(){return Object.freeze({execute(){throw Error("Business operation forbidden in startup fixture")}})}').join('\n'),
   }[args.path],loader:'js'}))
  }}
  const {getSg2SelectionRuntime}=await load('lib/platform/private-runtime.ts',[fixture])
  const {organisationContextSchemaDigest}=require('@profitia/platform-contracts/organisation-context')
  const urlFor=t=>{const u=new URL('postgresql://fixture:synthetic@'+t.hosts[0]+'/'+t.databaseName);u.username=t.runtimeRole;u.search='?sslmode=require';return u.toString()}
  const issuer='https://synthetic.clerk.accounts.dev'
  const env={PROFITIA_AUTH_PROVIDER:'clerk',TARGET_ENVIRONMENT:'development',APP_ENV:'development',
   PROFITIA_CLERK_ISSUER:issuer,PROFITIA_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from(new URL(issuer).host+'$').toString('base64url'),PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',PROFITIA_CLERK_AUTHORIZED_PARTIES:JSON.stringify(['https://sg2.example.test']),
   PROFITIA_PRIVATE_DATABASE_URL:urlFor(privateTarget),PROFITIA_OPERATION_CONFIGURATION_VERSION:JSON.parse(fs.readFileSync('deployment/private-runtime-targets.json','utf8')).configurationVersion,RENDER_SERVICE_ID:privateTarget.serviceId,RENDER_GIT_COMMIT:'a'.repeat(40),
   PROFITIA_ORGANISATION_CONTEXT_ENABLED:'true',PROFITIA_ORGANISATION_CONTEXT_SCHEMA_DIGEST:organisationContextSchemaDigest(),
   PROFITIA_ASSISTANT_ENABLED:'true',PROFITIA_ASSISTANT_CONFIGURATION_VERSION:target.configurationVersion,OPENAI_API_KEY:'synthetic-never-sent',PROFITIA_ASSISTANT_HISTORY_COMMAND_KEY:'a'.repeat(64),PROFITIA_ASSISTANT_USAGE_COMMAND_KEY:'b'.repeat(64),PROFITIA_ASSISTANT_HISTORY_DATABASE_URL:urlFor(target.history),PROFITIA_ASSISTANT_USAGE_DATABASE_URL:urlFor(target.usage)}
  delete globalThis.__sg2PrivateSelectionRuntime__
  const runtime=getSg2SelectionRuntime(env)
  assert.equal(runtime.provider,'clerk');assert.equal(runtime.assistant,undefined);assert.equal(typeof runtime.assistantForOrganisation,'function');assert.throws(()=>runtime.defaultOrganisationId)
  assert.equal(state.opened.length,2,'only existing business/audit pools before startup')
  globalThis.__organisationAssistantStartupRuntime=runtime
  const hook={name:'instrumentation-network-boundaries',setup(b){
   b.onResolve({filter:/^\.\/sentry\.(?:server|edge)\.config$/},()=>({path:'sentry',namespace:'hook-fixture'}))
   b.onResolve({filter:/^\.\/lib\/platform\/private-runtime$/},()=>({path:'runtime',namespace:'hook-fixture'}))
   b.onLoad({filter:/.*/,namespace:'hook-fixture'},args=>({contents:args.path==='runtime'?'export function getSg2SelectionRuntime(){return globalThis.__organisationAssistantStartupRuntime}':'export {}',loader:'js'}))
  }}
  const {register}=await load('instrumentation.ts',[hook])
  process.env.NEXT_RUNTIME='nodejs';process.env.PROFITIA_ASSISTANT_ENABLED='true'
  await register()
  assert.equal(state.opened.length,4);assert.equal(state.queries.filter(q=>q.includes('prune()')).length,1,'existing retention starts before a conversation')
  assert.ok(state.queries.some(q=>q.includes('descriptor()')));assert.ok(state.queries.some(q=>q.includes('pg_has_role')))
  const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const [first,second]=await Promise.all([runtime.assistantForOrganisation(a),runtime.assistantForOrganisation(b)])
  assert.equal(first.organisationId,a);assert.equal(second.organisationId,b);assert.notEqual(first.gateway,second.gateway)
  assert.equal(first.history,second.history);assert.equal(first.usage,second.usage);assert.equal(first.model,second.model)
  assert.equal(state.opened.length,4);assert.equal(state.queries.filter(q=>q.includes('prune()')).length,1)
  await assert.rejects(runtime.assistantForOrganisation('invalid'))
  state.denied=true
  await assert.rejects(register(),'startup keeps the actual resource role/schema validation fail-closed')
  await assert.rejects(runtime.assistantForOrganisation(a),'later requests still revalidate readiness')
  assert.throws(()=>runtime.defaultOrganisationId)
  globalThis.__organisationAssistantStartupRuntime={provider:'clerk',assistant:async()=>assert.fail('No legacy tenant fallback')}
  await assert.rejects(register(),/Assistant Development configuration unavailable/)
  process.env.PROFITIA_ASSISTANT_ENABLED='false';await register()
 }finally{
  globalThis.fetch=savedFetch
  for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v}
  delete globalThis.__organisationAssistantPrisma;delete globalThis.__sg2PrivateSelectionRuntime__;delete globalThis.__organisationAssistantStartupRuntime
 }
})
