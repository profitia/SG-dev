import type {AnalyticsModule} from './contract'
import {parseAdpNavigation} from '../appshell/adp-navigation'

/** Closed, source-owned descriptors. Never export a URL, query or resource ID. */
export function analyticsSurface(pathname: string, search = ''): {module: AnalyticsModule; view: string; section?: string; data_area?: string} {
  const path = pathname.replace(/^\/(pl|en)(?=\/|$)/, '').replace(/\/$/, '')
  if (path.split('/').includes('benchmark-finder')) return {module:'benchmark_finder',view:'benchmark_finder'}
  if (path === '/dashboard/adp') {
    const {view,section,dataArea} = parseAdpNavigation(search)
    return {module:'adp',view,...(view === 'data' ? {section,data_area:dataArea} : {})}
  }
  if (path === '/dashboard/xray') return {module:'xray',view:'xray'}
  if (path === '/dashboard') return {module:'appshell',view:'appshell'}
  if (path === '/account') return {module:'account',view:'account'}
  if (path === '/register') return {module:'account',view:'registration'}
  if (!path) return {module:'account',view:'sign_in'}
  if (path === '/category-builder') return {module:'category_builder',view:'category_builder'}
  if (path === '/cost-scan' || /^\/cost-scan\/category\/[^/]+$/.test(path)) return {module:'cost_scan',view:'cost_scan'}
  if (path === '/supplier-intelligence') return {module:'supplier_intelligence',view:'supplier_intelligence'}
  // New controls are observed automatically. A new route needs one safe descriptor.
  return {module:'other',view:'other'}
}

const finderContexts = '[data-appshell-module="benchmark-finder"],[data-testid="category-finder-modal"],[data-analytics-surface="finder"]'
const pendingFinderEntries = new WeakMap<Document,string>()
/** Close the transition gap before an asynchronous router/modal update is visible. */
export function markFinderEntry(document: Document) {pendingFinderEntries.set(document,document.location.pathname)}
export function resumeOrdinaryInteraction(document: Document) {
  if(!document.location.pathname.split('/').includes('benchmark-finder') && !Array.from(document.querySelectorAll(finderContexts)).some(isAnalyticsElementVisible))pendingFinderEntries.delete(document)
}
export const excludedTargetSelector = '[data-analytics-exclude],.ph-no-capture,.ph-no-autocapture,[data-ph-no-autocapture]'
export function isAnalyticsElementVisible(element: Element): boolean {
  if (!element.isConnected || element.closest('[hidden],[aria-hidden="true"],dialog:not([open])')) return false
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = node.ownerDocument.defaultView?.getComputedStyle(node)
    if (style?.display === 'none' || style?.visibility === 'hidden') return false
  }
  return true
}
export function isFinderContext(document: Document): boolean {
  if(document.location.pathname.split('/').includes('benchmark-finder') || Array.from(document.querySelectorAll(finderContexts)).some(isAnalyticsElementVisible)) {
    pendingFinderEntries.delete(document);return true
  }
  const pendingPath=pendingFinderEntries.get(document)
  if(pendingPath!==undefined && pendingPath!==document.location.pathname)pendingFinderEntries.delete(document)
  return pendingFinderEntries.has(document)
}
export function isFinderDestination(element: Element): boolean {
  const href = element.closest('a[href]')?.getAttribute('href')
  if (!href) return false
  try { return new URL(href, element.ownerDocument.location.href).pathname.split('/').includes('benchmark-finder') } catch { return true }
}
