import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevelopmentContext } from '../../../packages/platform-contracts/src/development-context.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export function resolveProbe(spec, consumerProjectKey, environment, taskId, sourceSha) {
  assertDevelopmentContext({ projectKey: environment.PROJECT_KEY, workspaceName: environment.PMOS_WORKSPACE_NAME, targetEnvironment: environment.TARGET_ENVIRONMENT }, { projectKey: 'ARCHITECTURE', workspaceName: 'SG-dev Architecture', targetEnvironment: 'development' })
  if (spec.projectKey !== 'ARCHITECTURE' || spec.targetEnvironment !== 'development' || !['SG2', 'SRM'].includes(consumerProjectKey)) throw new Error('Registered technical laboratory required')
  const resource = spec.resources.find((entry) => entry.kind === 'LAB' && entry.consumerProjectKey === consumerProjectKey)
  if (!resource || resource.neonProjectId !== 'fancy-cell-49425728') throw new Error('Laboratory resource is absent or foreign')
  let connection
  try { connection = new URL(environment[`ARCHITECTURE_${consumerProjectKey}_LAB_RUNTIME_URL`]) } catch { throw new Error('Protected laboratory configuration is missing or invalid') }
  const host = connection.hostname.replace('-pooler.', '.')
  if (!['postgres:', 'postgresql:'].includes(connection.protocol) || host !== resource.host || decodeURIComponent(connection.pathname.slice(1)) !== resource.databaseName || decodeURIComponent(connection.username) !== resource.runtimeRole || connection.searchParams.get('sslmode') !== 'require') throw new Error('Laboratory connection identity mismatch')
  if (typeof taskId !== 'string' || !taskId.startsWith('ARCHITECTURE-') || taskId.length > 160 || !/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Actual Architecture task and source SHA required')
  return { resource, connectionString: connection.href, taskId, evidence: { projectKey: 'ARCHITECTURE', consumerProjectKey, taskId, sourceSha, kind: 'E0_A_TECHNICAL_PROBE' } }
}

export function assertProbeEvidence(actual, expected) {
  if (JSON.stringify(actual, Object.keys(actual).sort()) !== JSON.stringify(expected, Object.keys(expected).sort())) throw new Error('Preserve the existing probe: same task has different evidence')
}

export async function runProbe(probe) {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: probe.connectionString, connectionTimeoutMillis: 15000 })
  await client.connect()
  try {
    const { rows: [identity] } = await client.query('SELECT current_database() AS database_name, current_user AS connected_role')
    if (identity.database_name !== probe.resource.databaseName || identity.connected_role !== probe.resource.runtimeRole) throw new Error('Connected laboratory identity mismatch')
    const inserted = await client.query('INSERT INTO public.architecture_lab_probes(project_key,task_key,evidence_json) VALUES($1,$2,$3::jsonb) ON CONFLICT(task_key) DO NOTHING RETURNING id', [probe.resource.consumerProjectKey, probe.taskId, JSON.stringify(probe.evidence)])
    const { rows: [row] } = await client.query('SELECT id,evidence_json FROM public.architecture_lab_probes WHERE task_key=$1', [probe.taskId])
    assertProbeEvidence(row.evidence_json, probe.evidence)
    return { status: inserted.rowCount ? 'CREATED' : 'IDEMPOTENT', ...identity, consumerProjectKey: probe.resource.consumerProjectKey, taskId: probe.taskId, probeId: row.id, sourceSha: probe.evidence.sourceSha }
  } finally { await client.end() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argument = (key) => process.argv[process.argv.indexOf(key) + 1]
    for (const key of ['--consumer', '--task-id', '--source-sha']) if (!process.argv.includes(key)) throw new Error('Explicit consumer, task ID and source SHA required')
    const spec = JSON.parse(fs.readFileSync(path.join(root, 'Canon/registries/architecture-onboarding-v1.json'), 'utf8'))
    const probe = resolveProbe(spec, argument('--consumer'), process.env, argument('--task-id'), argument('--source-sha'))
    console.log(JSON.stringify(await runProbe(probe), null, 2))
  } catch { console.error('Technical probe failed; preserve evidence and inspect protected configuration without emitting credentials'); process.exitCode = 1 }
}
