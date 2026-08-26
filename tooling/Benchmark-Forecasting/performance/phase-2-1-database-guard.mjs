export const PHASE_2_1_DATABASE_CLONE_ALIAS = 'phase-2-1-local-clone-v1'

const DATABASE_NAMES = Object.freeze({
  application: 'sg_phase_2_1_app',
  marketData: 'sg_phase_2_1_market_data',
})

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

export function phase21DatabaseName(role) {
  const databaseName = DATABASE_NAMES[role]
  if (!databaseName) {
    throw new Error(`Unsupported Phase 2.1 database role: ${role}`)
  }
  return databaseName
}

export function assertPhase21DatabaseTarget({ databaseUrl, cloneAlias, role }) {
  if (cloneAlias !== PHASE_2_1_DATABASE_CLONE_ALIAS) {
    throw new Error('Phase 2.1 database clone alias is absent or does not match the approved isolated alias.')
  }

  let target
  try {
    target = new URL(databaseUrl)
  } catch {
    throw new Error('Phase 2.1 database URL is invalid.')
  }

  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('Phase 2.1 database target must use PostgreSQL.')
  }
  if (!LOOPBACK_HOSTS.has(target.hostname)) {
    throw new Error('Phase 2.1 database target must resolve to the isolated local PostgreSQL instance.')
  }

  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''))
  const expectedDatabaseName = phase21DatabaseName(role)
  if (databaseName !== expectedDatabaseName) {
    throw new Error(`Phase 2.1 ${role} target must use database ${expectedDatabaseName}.`)
  }

  return {
    cloneAlias,
    databaseName,
    host: target.hostname,
    isolated: true,
  }
}