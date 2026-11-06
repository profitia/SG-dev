import {CalendarError, ECR_APPLICATION} from '@profitia/economic-calendar-contracts'
const required = (env, key) => {const value = env[key]; if (typeof value !== 'string' || !value.length) throw new CalendarError('CONFIGURATION_REQUIRED', 503); return value}
const origin = value => {const u = new URL(value); if (u.protocol !== 'https:' || u.origin !== value || u.username || u.password || u.hostname.includes('*')) throw new CalendarError('CONFIGURATION_REFUSED', 503); return value}
export function loadConfiguration(env = process.env, purpose = 'runtime') {
  if (env.ECR_ENVIRONMENT !== 'development' || !['runtime', 'ingest', 'migrator'].includes(purpose)) throw new CalendarError('DEVELOPMENT_CONFIGURATION_REQUIRED', 503)
  const role = purpose === 'runtime' ? 'economic_calendar_development_runtime' : purpose === 'ingest' ? 'economic_calendar_development_ingest' : 'economic_calendar_development_migrator'
  const url = new URL(required(env, purpose === 'runtime' ? 'ECR_DATABASE_URL' : purpose === 'ingest' ? 'ECR_INGEST_DATABASE_URL' : 'ECR_MIGRATOR_DATABASE_URL'))
  const databaseName = required(env, 'ECR_DATABASE_NAME'), host = required(env, 'ECR_DATABASE_HOST')
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== host || !host.endsWith('.neon.tech')
    || decodeURIComponent(url.username) !== role || decodeURIComponent(url.pathname) !== '/' + databaseName
    || !['require', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '') || [...url.searchParams.keys()].some(k => !['sslmode', 'channel_binding'].includes(k))
    || !/^[a-z][a-z0-9_]{1,62}$/.test(databaseName) || ['architecture_pmos', 'sg2_pmos', 'srm_pmos', 'architecture_sg_lab', 'architecture_srm_lab'].includes(databaseName)) throw new CalendarError('PRODUCT_DATABASE_BINDING_REQUIRED', 503)
  const deploymentId = required(env, purpose === 'runtime' ? 'RENDER_GIT_COMMIT' : 'ECR_EXECUTION_SHA')
  if (!/^[a-f0-9]{40}$/.test(deploymentId)) throw new CalendarError('EXACT_DEPLOYMENT_SHA_REQUIRED', 503)
  const port = Number(env.PORT ?? 3214)
  if(!Number.isSafeInteger(port)||port<1||port>65535)throw new CalendarError('INVALID_PORT',503)
  const publicOrigin = origin(required(env, 'ECR_PUBLIC_ORIGIN'))
  const allowedOrigins = (env.ECR_ALLOWED_ORIGINS ?? publicOrigin).split(',').map(origin)
  return Object.freeze({applicationId: ECR_APPLICATION, environment: 'development', projectId: required(env, 'ECR_NEON_PROJECT_ID'), branchId: required(env, 'ECR_NEON_BRANCH_ID'),
    databaseName, runtimeRole: role, connectionString: url.href, deploymentId, configurationVersion: required(env, 'ECR_CONFIGURATION_VERSION'),
    publicOrigin, identityIssuer: origin(required(env, 'ECR_IDENTITY_ISSUER')), allowedOrigins: Object.freeze(allowedOrigins), port})
}
