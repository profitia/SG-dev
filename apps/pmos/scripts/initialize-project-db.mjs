#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(appRoot, '../..')
const specPath = 'Canon/registries/architecture-onboarding-v1.json'
const expectedDatabases = { pmos: 'architecture_pmos', 'sg-lab': 'architecture_sg_lab', 'srm-lab': 'architecture_srm_lab' }

export function resolveInitializationTarget(spec, key, validation = false) {
  if (spec.schemaVersion !== '1.0' || spec.projectKey !== 'ARCHITECTURE' || spec.targetEnvironment !== 'development') throw new Error('Only authorized Architecture Development initialization is supported')
  const resource = spec.resources?.find((entry) => entry.key === key)
  if (!resource || resource.databaseName !== expectedDatabases[key]) throw new Error('Unregistered initialization target')
  if (resource.kind === 'PMOS' && (resource.neonProjectId !== 'billowing-credit-07394675' || resource.schemaPath !== 'apps/pmos/prisma/schema.prisma')) throw new Error('Wrong PMOS source or project')
  if (resource.kind === 'LAB' && (resource.neonProjectId !== 'fancy-cell-49425728' || !['SG2', 'SRM'].includes(resource.consumerProjectKey))) throw new Error('Wrong laboratory project')
  if (validation) {
    if (key !== 'pmos' || spec.validation?.purpose !== 'EMPTY_PMOS_SCHEMA_VALIDATION_ONLY' || spec.validation.neonProjectId !== resource.neonProjectId || spec.validation.parentBranchId !== resource.branchId || spec.validation.branchId === resource.branchId) throw new Error('Invalid schema validation branch')
    return { ...resource, branchId: spec.validation.branchId, endpointId: spec.validation.endpointId, host: spec.validation.host, ownerUrlEnvironmentKey: spec.validation.ownerUrlEnvironmentKey }
  }
  return resource
}

export function assertInitializationConnection(resource, value) {
  let connection
  try { connection = new URL(value) } catch { throw new Error('Initialization connection is absent or invalid') }
  if (!['postgres:', 'postgresql:'].includes(connection.protocol) || connection.hostname !== resource.host || connection.hostname.includes('-pooler.') || decodeURIComponent(connection.pathname.slice(1)) !== resource.databaseName || decodeURIComponent(connection.username) !== resource.ownerRole || !connection.password || connection.searchParams.get('sslmode') !== 'require') throw new Error('Initialization connection must match the exact registered direct owner identity')
}

export function assertEmptyInitializationState(resource, observed) {
  if (observed.database_name !== resource.databaseName || observed.connected_role !== resource.ownerRole) throw new Error('Connected database identity mismatch')
  if (Number(observed.relation_count) !== 0) throw new Error('Initialization requires an empty database; preserve existing data and reconcile any partial attempt')
}

function schemaInput(resource) {
  if (resource.kind === 'PMOS') return fs.readFileSync(path.join(repositoryRoot, resource.schemaPath), 'utf8')
  return `CREATE TABLE public.architecture_lab_probes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_key text NOT NULL CHECK (project_key = '${resource.consumerProjectKey}'),
    task_key text NOT NULL UNIQUE,
    observed_at timestamptz NOT NULL DEFAULT now(),
    evidence_json jsonb NOT NULL
  )`
}

export async function initializeProjectDatabase(spec, key, environment = process.env, validation = false) {
  const resource = resolveInitializationTarget(spec, key, validation)
  const uri = environment[resource.ownerUrlEnvironmentKey]
  assertInitializationConnection(resource, uri)
  const schema = schemaInput(resource)
  const schemaHash = createHash('sha256').update(schema).digest('hex')
  const client = new PrismaClient({ datasources: { db: { url: uri } } })
  try {
    const [observed] = await client.$queryRawUnsafe(`SELECT current_database() AS database_name, current_user AS connected_role,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%') AS relation_count`)
    const [marker] = await client.$queryRawUnsafe("SELECT to_regclass('architecture_bootstrap.initialization')::text AS marker")
    if (marker.marker) {
      const records = await client.$queryRawUnsafe('SELECT resource_key, schema_hash FROM architecture_bootstrap.initialization')
      if (records.length !== 1 || records[0].resource_key !== key || records[0].schema_hash !== schemaHash || observed.database_name !== resource.databaseName || observed.connected_role !== resource.ownerRole) throw new Error('Existing initialization does not match this exact contract; preserve it')
      return { status: 'IDEMPOTENT', resourceKey: key, databaseName: resource.databaseName, branchId: resource.branchId, schemaHash }
    }
    assertEmptyInitializationState(resource, observed)
    if (resource.kind === 'PMOS') {
      const command = spawnSync(path.join(appRoot, 'node_modules/.bin/prisma'), ['db', 'push', '--schema', path.join(repositoryRoot, resource.schemaPath), '--skip-generate'], { cwd: appRoot, encoding: 'utf8', env: { ...environment, DATABASE_URL: uri, DIRECT_URL: uri } })
      if (command.status !== 0) throw new Error('Prisma schema initialization failed; inspect the retained database before retry')
    } else await client.$executeRawUnsafe(schema)
    await client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE SCHEMA architecture_bootstrap')
      await tx.$executeRawUnsafe('REVOKE ALL ON SCHEMA architecture_bootstrap FROM PUBLIC')
      await tx.$executeRawUnsafe('CREATE TABLE architecture_bootstrap.initialization (resource_key text PRIMARY KEY, schema_hash text NOT NULL, initialized_at timestamptz NOT NULL DEFAULT now(), initialized_by text NOT NULL DEFAULT current_user)')
      await tx.$executeRawUnsafe('INSERT INTO architecture_bootstrap.initialization (resource_key,schema_hash) VALUES ($1,$2)', key, schemaHash)
    })
    const relations = await client.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    return { status: 'INITIALIZED', resourceKey: key, databaseName: resource.databaseName, branchId: resource.branchId, schemaHash, publicTables: relations.map((row) => row.tablename) }
  } finally { await client.$disconnect() }
}

// Neon API roles inherit neon_superuser. Runtime identities must instead be
// ordinary SQL-created roles; never persist or rotate an existing role here.
export async function provisionRuntimeRole(spec, key, outputPath, environment = process.env) {
  const resource = resolveInitializationTarget(spec, key)
  const uri = environment[resource.ownerUrlEnvironmentKey]
  assertInitializationConnection(resource, uri)
  if (!/^architecture_(pmos|sg_lab|srm_lab)_runtime$/.test(resource.runtimeRole)) throw new Error('Unregistered runtime role')
  if (!path.isAbsolute(outputPath) || fs.existsSync(outputPath)) throw new Error('A new absolute protected configuration path is required')
  const client = new PrismaClient({ datasources: { db: { url: uri } } })
  try {
    const marker = await client.$queryRawUnsafe('SELECT resource_key FROM architecture_bootstrap.initialization')
    if (marker.length !== 1 || marker[0].resource_key !== key) throw new Error('The exact database must be initialized before role provisioning')
    const roles = await client.$queryRawUnsafe('SELECT rolname FROM pg_roles WHERE rolname=$1', resource.runtimeRole)
    if (roles.length) throw new Error('Preserve the existing runtime role; provisioning never resets credentials')
    const credential = randomBytes(32).toString('hex')
    const direct = new URL(uri)
    direct.username = resource.runtimeRole
    direct.password = credential
    const pooled = new URL(direct)
    pooled.hostname = pooled.hostname.replace('.c-', '-pooler.c-')
    fs.writeFileSync(outputPath, `DATABASE_URL=${JSON.stringify(pooled.href)}\nDIRECT_URL=${JSON.stringify(direct.href)}\n`, { flag: 'wx', mode: 0o600 })
    try {
      await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`CREATE ROLE ${resource.runtimeRole} LOGIN PASSWORD '${credential}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`)
        await tx.$executeRawUnsafe(`REVOKE ALL ON DATABASE ${resource.databaseName} FROM PUBLIC`)
        await tx.$executeRawUnsafe(`GRANT CONNECT ON DATABASE ${resource.databaseName} TO ${resource.runtimeRole}`)
        await tx.$executeRawUnsafe('REVOKE ALL ON SCHEMA public FROM PUBLIC')
        await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${resource.runtimeRole}`)
        await tx.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${resource.runtimeRole}`)
        await tx.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${resource.runtimeRole}`)
        await tx.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES FOR ROLE ${resource.ownerRole} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${resource.runtimeRole}`)
        await tx.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES FOR ROLE ${resource.ownerRole} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${resource.runtimeRole}`)
        await tx.$executeRawUnsafe(`REVOKE ALL ON SCHEMA architecture_bootstrap FROM ${resource.runtimeRole}`)
      })
    } catch (error) {
      fs.unlinkSync(outputPath)
      throw error
    }
    return { status: 'RUNTIME_ROLE_PROVISIONED', databaseName: resource.databaseName, runtimeRole: resource.runtimeRole, branchId: resource.branchId, configurationMode: '0600', credentialEmitted: false }
  } finally { await client.$disconnect() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const keyIndex = process.argv.indexOf('--key')
    if (keyIndex < 0) throw new Error('Explicit --key required')
    const spec = JSON.parse(fs.readFileSync(path.join(repositoryRoot, specPath), 'utf8'))
    const outputIndex = process.argv.indexOf('--runtime-config')
    const result = outputIndex < 0
      ? await initializeProjectDatabase(spec, process.argv[keyIndex + 1], process.env, process.argv.includes('--validation'))
      : await provisionRuntimeRole(spec, process.argv[keyIndex + 1], process.argv[outputIndex + 1])
    console.log(JSON.stringify(result, null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
