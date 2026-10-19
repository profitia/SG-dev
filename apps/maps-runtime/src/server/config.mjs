import {exactOrigin} from '@profitia/maps-contracts'

export function readConfig(env = process.env) {
  if (env.TARGET_ENVIRONMENT !== 'development') throw new Error('This connector slice requires Development')
  const origins = (env.MAPS_ALLOWED_HOST_ORIGINS || '').split(',').filter(Boolean).map(exactOrigin)
  const browserKey = env.MAPS_BROWSER_API_KEY || ''
  const mapId = env.MAPS_MAP_ID || ''
  if (browserKey && !/^AIza[\w-]{30,60}$/.test(browserKey)) throw new Error('Invalid browser key configuration')
  if (mapId && !/^[a-zA-Z0-9_-]{6,80}$/.test(mapId)) throw new Error('Invalid map ID configuration')
  return Object.freeze({environment: 'development', browserKey, mapId, allowedHostOrigins: origins,
    configured: Boolean(browserKey && mapId), revision: env.RENDER_GIT_COMMIT || env.MAPS_SOURCE_SHA || 'local'})
}

export function publicConfig(config) {
  return {environment: config.environment, browserKey: config.browserKey, mapId: config.mapId,
    allowedHostOrigins: config.allowedHostOrigins, configured: config.configured, revision: config.revision}
}
