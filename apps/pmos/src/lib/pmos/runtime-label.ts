import { assertDatabaseIdentity } from './execution-registration'
import { assertPmosControlPlaneEnvironment, getConfiguredPmosProjectName, requirePmosProjectProfile } from './project-profile'

export function resolvePmosRuntimeLabel(env: NodeJS.ProcessEnv = process.env) {
  const profile = requirePmosProjectProfile(getConfiguredPmosProjectName(env))
  const targetEnvironment = env.TARGET_ENVIRONMENT?.trim().toLowerCase() || profile.continuity.controlPlaneEnvironment || 'development'
  if (!['development', 'staging', 'production'].includes(targetEnvironment)) throw new Error('Unknown PMOS target environment')
  assertPmosControlPlaneEnvironment(profile, targetEnvironment)
  if (env.DATABASE_URL) {
    let databaseName: string
    try { databaseName = decodeURIComponent(new URL(env.DATABASE_URL).pathname.slice(1)) } catch { throw new Error('Invalid PMOS connection configuration') }
    assertDatabaseIdentity(databaseName, profile.displayName, env.DATABASE_URL)
  }
  return { projectKey: profile.projectKey, projectName: profile.displayName, targetEnvironment, title: `PMOS · ${profile.displayName} · ${targetEnvironment}` }
}
