export const ADP_ACTIONS = ['form.change','form.role','form.answer','owner.select','category.assign','category.remove','category.suggest','contact.add','location.add','relation.add','activity.add','document.add','rating.add','warning.add','warning.remove','plan.change','activity.complete','keyword.add','keyword.edit','keyword.remove'] as const
const modules = ['appshell','benchmark_finder','price_change_index','adp','xray','account','category_builder','cost_scan','supplier_intelligence','other'] as const
export const CONTROL_IDS = ['structural','launch_adp','launch_xray','theme_light','theme_dark','sign_out','category-name-input','category-context-input','category-ask-suggestions','category-save-button','category_new','category_open','cost_scan_open','cost_scan_range','supplier_summary_form','supplier_summary_read','supplier_period','assistant_toggle','assistant_send'] as const
export type AnalyticsModule = typeof modules[number]
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export const isRandomId = (v: unknown): v is string => typeof v === 'string' && uuid.test(v)
const enums: Record<string, readonly (string | number)[]> = {
  module: modules, entry_point: ['appshell','benchmark_finder','direct'],
  operation: ['benchmark_search','benchmark_selection','pci_analysis','pci_category_save','account_verify','category_list','category_read','category_save','category_suggestions','cost_scan','supplier_summary_read'],
  step: [1,2,3,'result'],
  status: ['success','error','empty','partial','left_incomplete','PREPARED','CALCULATED','PROXY_MARKET_ONLY','REFUSED','ERROR'],
  mode: ['simple','advanced','exact','ai','create','update'],
  view: ['appshell','benchmark_finder','price_change_index','xray','overview','data','cooperation','activities','documents','ratings','newsfeed','account','registration','sign_in','category_builder','cost_scan','supplier_intelligence','other'],
  section: ['company','registers','payments','activity','declarations'], data_area: ['adp','contacts','relations'],
  action_type: ADP_ACTIONS,
  control_id: CONTROL_IDS, interaction:['click','change','first_edit','validation_failed'], reason:['navigation','page_hidden','interval'],
  control_type:['button','link','field','choice','tab','chart','form','other'],
  feedback:['alert'], metric:['long_task','next_frame_delay'], error_kind:['render_failed'],
}
const surfaceFields = ['view','section','data_area'] as const
const controlFields = [...surfaceFields,'control_id','control_path','control_type'] as const
// Event-specific fields follow the existing project 329829 definitions. No free text.
const fields = {
  app_opened: ['entry_point'], auth_session_established: [], module_opened: ['entry_point'], screen_viewed: ['view','step','section','data_area'],
  operation_started: ['operation','process_attempt_id'], operation_completed: ['operation','process_attempt_id','duration_ms','status'], operation_failed: ['operation','process_attempt_id','duration_ms','status'],
  operation_limited: ['operation','process_attempt_id','duration_ms','status'], operation_left_incomplete: ['operation','process_attempt_id','duration_ms','status'],
  session_started: [], surface_entered: surfaceFields, ui_interaction: [...controlFields,'interaction'], form_started: controlFields, form_submitted: controlFields, form_left_incomplete: controlFields,
  screen_activity: [...surfaceFields,'duration_ms','interaction_count','reason'], ui_feedback_shown: [...surfaceFields,'feedback'],
  performance_measured: [...surfaceFields,'metric','duration_ms'], application_error: ['error_kind'],
  benchmark_search_submitted: ['mode','process_attempt_id'], benchmark_results_displayed: ['mode','process_attempt_id','result_count','status'], benchmark_selected: ['process_attempt_id'],
  benchmark_analysis_started: ['process_attempt_id'], benchmark_analysis_completed: ['process_attempt_id','duration_ms'],
  pci_build_category_clicked: ['entry_point'], pci_opened: ['entry_point'], pci_step_viewed: ['step'],
  pci_preparation_finished: ['status','duration_ms'], pci_analysis_requested: ['process_attempt_id'], pci_analysis_finished: ['status','process_attempt_id','duration_ms'],
  pci_category_save_requested: ['mode','process_attempt_id'], pci_category_save_finished: ['mode','status','process_attempt_id','duration_ms'], pci_closed: ['step'],
  adp_view_opened: ['view'], adp_form_section_opened: ['section','data_area'], adp_local_action_performed: ['action_type'], adp_returned_to_appshell: [],
  xray_supplier_search_submitted: ['process_attempt_id'], xray_supplier_results_displayed: ['result_count','status','process_attempt_id'], xray_report_opened: [], xray_financials_viewed: [],
} as const
export type AnalyticsEvent = keyof typeof fields
export type AnalyticsProperties = Record<string, unknown> & { module: AnalyticsModule }
/** Stage one excludes the Finder's complete event surface, including generic
 * events accidentally labelled as another module. Definitions remain intact. */
export function isProductAnalyticsEventEnabled(event: string, properties: Record<string, unknown>): boolean {
  return properties.module !== 'benchmark_finder' && properties.view !== 'benchmark_finder'
    && properties.entry_point !== 'benchmark_finder' && !event.startsWith('benchmark_')
    && properties.operation !== 'benchmark_search' && properties.operation !== 'benchmark_selection'
}
const expectedModule = (event: string): AnalyticsModule | null => event.startsWith('pci_') ? 'price_change_index' : event.startsWith('benchmark_') ? 'benchmark_finder' : event.startsWith('adp_') ? 'adp' : event.startsWith('xray_') ? 'xray' : null

export function validateBusinessEvent(event: string, properties: Record<string, unknown>, strict = true): Record<string, unknown> | null {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null
  if (!Object.hasOwn(fields, event) || !modules.includes(properties.module as AnalyticsModule)) return null
  if (expectedModule(event) && properties.module !== expectedModule(event)) return null
  const allowed = new Set<string>(['module','release_sha', ...fields[event as AnalyticsEvent]])
  const result: Record<string, unknown> = { application: 'SG2', environment: 'development' }
  for (const [key,value] of Object.entries(properties)) {
    if (key === 'application' || key === 'environment') continue
    if (!allowed.has(key)) { if (strict) return null; continue }
    if (key === 'release_sha' ? typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)
      : key === 'process_attempt_id' ? !isRandomId(value)
      : key === 'control_path' ? typeof value !== 'string' || !/^(?:(?:html|body|main|section|article|nav|header|footer|aside|div|form|fieldset|label|button|a|input|select|textarea|summary|details|ul|ol|li|table|thead|tbody|tr|td|th|span|p|svg|g|path|canvas):[1-9][0-9]{0,3})(?:\/(?:html|body|main|section|article|nav|header|footer|aside|div|form|fieldset|label|button|a|input|select|textarea|summary|details|ul|ol|li|table|thead|tbody|tr|td|th|span|p|svg|g|path|canvas):[1-9][0-9]{0,3}){0,7}$/.test(value)
      : key === 'duration_ms' || key === 'result_count' || key === 'interaction_count' ? typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > (key === 'duration_ms' ? 86400000 : 100000)
      : !enums[key]?.includes(value as string | number)) return null
    result[key] = value
  }
  if (event.startsWith('operation_') && (!result.operation || !result.process_attempt_id)) return null
  if (event === 'module_opened' && !result.entry_point) return null
  const statuses: Record<string, string[]> = {operation_completed:['success','CALCULATED'],operation_failed:['error','REFUSED'],operation_limited:['partial','empty'],operation_left_incomplete:['left_incomplete'],
    benchmark_results_displayed:['success','empty'],pci_preparation_finished:['PREPARED','REFUSED','ERROR'],
    pci_analysis_finished:['CALCULATED','PROXY_MARKET_ONLY','REFUSED','ERROR'],pci_category_save_finished:['success','error']}
  if (statuses[event] && !statuses[event].includes(result.status as string)) return null
  if (event.startsWith('pci_category_save_') && !['create','update'].includes(result.mode as string)) return null
  if (event === 'benchmark_search_submitted' && !['simple','advanced','exact','ai'].includes(result.mode as string)) return null
  if (event === 'pci_step_viewed' && ![1,2,3,'result'].includes(result.step as string | number)) return null
  if (event === 'adp_local_action_performed' && !result.action_type) return null
  if (['ui_interaction','form_started','form_submitted','form_left_incomplete'].includes(event) && (!result.control_path || !result.control_id || !result.view)) return null
  if (event === 'ui_interaction' && !result.interaction) return null
  if (event === 'performance_measured' && (!result.metric || result.duration_ms === undefined)) return null
  return result
}

/** Last boundary, after SDK enrichment. Preserve the SDK envelope/UUID/timestamp/token,
 * but remove person updates, URLs, referrers, geo/browser details and all unknown fields. */
export function filterSdkEvent<T extends { event: string; properties: Record<string, unknown> }>(data: T, permitted: boolean, projectToken: string): T | null {
  if (!permitted) return null
  const properties = validateBusinessEvent(data.event, data.properties, false)
  if (!properties || !isProductAnalyticsEventEnabled(data.event, properties)
    || !isRandomId(data.properties.distinct_id) || data.properties.token !== projectToken) return null
  // SDK ingestion credential, not an account/session token; required by /i/v0/e.
  properties.token = projectToken
  for (const key of ['distinct_id','$device_id','$session_id','$window_id']) {
    if (isRandomId(data.properties[key])) properties[key] = data.properties[key]
  }
  for (const key of ['$lib','$lib_version']) {
    const value = data.properties[key]
    if (typeof value === 'string' && /^[A-Za-z0-9._-]{1,32}$/.test(value)) properties[key] = value
  }
  properties.$process_person_profile = false
  properties.$is_identified = false
  // ip:false does not suppress ingestion-side enrichment. This policy flag is
  // forced after filtering, so neither callers nor SDK enrichment can unset it.
  properties.$geoip_disable = true
  // These are the transport envelope fields produced by pinned posthog-js 1.444.0.
  const envelope = data as T & { uuid?: unknown; timestamp?: unknown }
  return { event: data.event, properties, uuid: envelope.uuid, timestamp: envelope.timestamp } as unknown as T
}
