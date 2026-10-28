import type {AdpDataArea, AdpFormSection, AdpLocale, AdpNavigation, AdpView} from '@profitia/srm-adp-ui'

const views: readonly AdpView[] = ['overview', 'data', 'cooperation', 'activities', 'documents', 'ratings', 'xray', 'newsfeed']
const sections: readonly AdpFormSection[] = ['company', 'registers', 'payments', 'activity', 'declarations']
const areas: readonly AdpDataArea[] = ['adp', 'contacts', 'relations']
export const DEFAULT_ADP_NAVIGATION: AdpNavigation = {view: 'overview', section: 'company', dataArea: 'adp'}

export const dashboardPath = (locale: AdpLocale) => `/${locale === 'en' ? 'en' : 'pl'}/dashboard`
export const isAdpPath = (pathname: string, locale: AdpLocale) => pathname.replace(/\/$/, '') === `${dashboardPath(locale)}/adp`

export function parseAdpNavigation(search: string): AdpNavigation {
  const query = new URLSearchParams(search)
  const view = query.get('view'), section = query.get('section'), area = query.get('area')
  return {
    view: views.includes(view as AdpView) ? view as AdpView : 'overview',
    section: sections.includes(section as AdpFormSection) ? section as AdpFormSection : 'company',
    dataArea: areas.includes(area as AdpDataArea) ? area as AdpDataArea : 'adp',
  }
}

export function adpPath(locale: AdpLocale, navigation: AdpNavigation = DEFAULT_ADP_NAVIGATION): string {
  const safe = parseAdpNavigation(new URLSearchParams({view: navigation.view, section: navigation.section, area: navigation.dataArea}).toString())
  const query = new URLSearchParams()
  if (safe.view !== 'overview') query.set('view', safe.view)
  if (safe.section !== 'company') query.set('section', safe.section)
  if (safe.dataArea !== 'adp') query.set('area', safe.dataArea)
  return `${dashboardPath(locale)}/adp${query.size ? `?${query}` : ''}`
}
