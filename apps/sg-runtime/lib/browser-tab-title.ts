type AppEnvironment = 'development' | 'staging' | 'production'

export function getEnvironmentBrowserTabTitle(baseTitle: string, environment: AppEnvironment): string {
  if (environment === 'development') return `DEV ${baseTitle}`
  if (environment === 'staging') return `STAGE ${baseTitle}`
  return baseTitle
}
