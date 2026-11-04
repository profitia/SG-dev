import {productAnalytics, type ProductAnalytics} from './adapter'
import {analyticsSurface, excludedTargetSelector, isAnalyticsElementVisible, isFinderContext, isFinderDestination} from './surfaces'
import {CONTROL_IDS} from './contract'

const interactive = 'button,a[href],input,select,textarea,summary,[role="button"],[role="tab"],[role="checkbox"],[role="switch"],[role="radio"],[role="option"],[role="slider"],[contenteditable="true"]'
const tags = new Set(['html','body','main','section','article','nav','header','footer','aside','div','form','fieldset','label','button','a','input','select','textarea','summary','details','ul','ol','li','table','thead','tbody','tr','td','th','span','p','svg','g','path','canvas'])
/** Tag/ordinal only: no text, labels, CSS classes, DOM IDs, values or hashes thereof. */
export function structuralControlPath(element: Element): string {
  const parts: string[] = []
  for (let node: Element | null = element; node && parts.length < 8; node = node.parentElement) {
    const tag = node.localName, parent: Element | null = node.parentElement
    const ordinal = parent ? Array.from(parent.children).filter(sibling => sibling.localName === tag).indexOf(node) + 1 : 1
    parts.unshift(`${tags.has(tag) ? tag : 'div'}:${Math.min(9999, Math.max(1, ordinal))}`)
  }
  return parts.join('/')
}
function controlId(element: Element): string {
  const candidate = element.closest('[data-analytics-id]')?.getAttribute('data-analytics-id') ?? element.getAttribute('data-testid')
  return CONTROL_IDS.includes(candidate as typeof CONTROL_IDS[number]) ? candidate! : 'structural'
}
function controlType(element: Element): string {
  const role=element.getAttribute('role')
  if(role==='tab')return 'tab'
  if(element.matches('svg,canvas'))return 'chart'
  if(element.matches('form'))return 'form'
  if(element.matches('a'))return 'link'
  if(element.matches('select,input[type="checkbox"],input[type="radio"]')||['checkbox','radio','switch','option','slider'].includes(role??''))return 'choice'
  if(element.matches('input,textarea,[contenteditable]'))return 'field'
  if(element.matches('button,summary')||role==='button')return 'button'
  return 'other'
}
function safeControl(element: Element): boolean {
  if (!isAnalyticsElementVisible(element) || element.closest(excludedTargetSelector) || isFinderDestination(element)) return false
  // Credential widgets, file pickers and secret/one-time-code controls are excluded entirely.
  if (element.closest('input[type="password"],input[type="hidden"],input[type="file"],[autocomplete="one-time-code"],[autocomplete="current-password"],[autocomplete="new-password"]')) return false
  if(/(?:^|\s)(?:one-time-code|current-password|new-password)(?:\s|$)/.test(element.getAttribute('autocomplete')??''))return false
  return true
}

/** One bounded delegated observer on the existing adapter, including embedded React UI.
 * Submit is an intent. Only authoritative operation callbacks can report success.
 * No interception of fetch, identity, business commands or form contents. */
export function startApplicationMonitoring(win: Window & typeof globalThis, permitted: () => boolean, analytics: ProductAnalytics = productAnalytics) {
  const doc = win.document
  let stopped = false, currentKey = '', previousUrl = '', started = 0, activeMs = 0, lastTick = win.performance.now(), interactions = 0
  let surface = analyticsSurface(win.location.pathname, win.location.search), routeStarted = lastTick, frame: number | undefined
  const forms = new Map<Element, {path:string; id:string; submitted:boolean}>()
  let sessionEpoch=analytics.sessionEpoch()
  let alerted = new WeakSet<Element>(), edited = new WeakSet<Element>()
  const clock = () => win.performance.now()
  const canCapture = () => !stopped && analytics.isReady() && permitted() && !isFinderContext(doc)
  const forget = () => {
    if(currentKey){analytics.clearTransition('screen');analytics.clearTransition('module')}
    currentKey='';forms.clear();edited=new WeakSet();alerted=new WeakSet();activeMs=0;interactions=0;analytics.discardAttempts()
  }
  const summary = (reason:'navigation'|'page_hidden'|'interval') => {
    if (currentKey && canCapture()) analytics.capture('screen_activity',{...surface,duration_ms:Math.min(86400000,Math.round(activeMs)),interaction_count:Math.min(100000,interactions),reason})
    activeMs=0; interactions=0
  }
  const sync = () => {
    const now = clock(), elapsed = Math.min(1500,Math.max(0,now-lastTick)); lastTick=now
    if(sessionEpoch!==analytics.sessionEpoch()){forget();sessionEpoch=analytics.sessionEpoch()}
    if (!canCapture()) { forget(); return false }
    if (currentKey && doc.visibilityState !== 'hidden') activeMs+=elapsed
    const next = analyticsSurface(win.location.pathname,win.location.search)
    const key = JSON.stringify(next), url = win.location.pathname+win.location.search
    if (next.module === 'benchmark_finder') {forget();return false}
    if (key !== currentKey || url!==previousUrl) {
      if (currentKey) {
        summary('navigation')
        for (const form of forms.values()) if(!form.submitted) analytics.capture('form_left_incomplete',{...surface,control_path:form.path,control_id:form.id})
        analytics.leaveAttempts()
      }
      forms.clear(); edited=new WeakSet(); alerted=new WeakSet(); surface=next; currentKey=key; started=now; routeStarted=now
      analytics.once('monitoring-session','session_started',{module:'appshell'})
      analytics.once('app','app_opened',{module:'appshell',entry_point:'appshell'})
      if(surface.module==='appshell') analytics.clearTransition('module')
      else analytics.transition('module',surface.module,'module_opened',{module:surface.module,entry_point:'direct'})
      const screenKey=surface.module==='adp'?`adp:${surface.view}:${surface.section??'company'}:${surface.data_area??'adp'}`:surface.module
      analytics.transition('screen',screenKey,'screen_viewed',surface)
      const frameKey=key, frameStart=now
      if(frame!==undefined)win.cancelAnimationFrame(frame)
      frame=win.requestAnimationFrame(()=>{frame=win.requestAnimationFrame(()=>{
        frame=undefined
        if(canCapture()&&currentKey===frameKey&&routeStarted===frameStart)analytics.capture('performance_measured',{...surface,metric:'next_frame_delay',duration_ms:Math.min(86400000,Math.round(clock()-frameStart))})
      })})
    }
    if (url!==previousUrl) {previousUrl=url;routeStarted=now}
    return true
  }
  const event = (incoming: Event) => {
    const raw = incoming.target
    if (!(raw instanceof win.Element)) return
    if(raw.closest('[data-analytics-exclude="finder"]')||isFinderDestination(raw)){forget();return}
    if (!sync()) return
    const element = incoming.type==='submit' ? raw.closest('form') : raw.closest(interactive) ?? raw.closest('canvas,svg')
    if (!element || !safeControl(element)) return
    if(surface.module==='account'&&surface.view!=='account'&&element.matches('input,textarea,form,[contenteditable]'))return
    // Excluded launch buttons must not produce form, navigation or click events.
    if (raw.closest(excludedTargetSelector) || isFinderDestination(raw)) return
    const properties = {...surface,control_path:structuralControlPath(element),control_id:controlId(element),control_type:controlType(element)}
    const form = element.closest('form')
    if(form && !forms.has(form)) {
      const info={path:structuralControlPath(form),id:controlId(form),submitted:false};forms.set(form,info)
      analytics.capture('form_started',{...surface,control_path:info.path,control_id:info.id})
    }
    let action:string=incoming.type
    if(incoming.type==='input') {
      if(edited.has(element))return
      edited.add(element);action='first_edit'
    }
    if(incoming.type==='invalid') action='validation_failed'
    if(incoming.type==='submit') {
      const state=forms.get(element);if(state)state.submitted=true
      analytics.capture('form_submitted',properties)
    } else analytics.capture('ui_interaction',{...properties,interaction:action})
    interactions++
  }
  const feedback = () => {
    if (!sync()) return
    for(const element of Array.from(doc.querySelectorAll('[role="alert"]'))) {
      if(alerted.has(element)||!safeControl(element))continue
      alerted.add(element);analytics.capture('ui_feedback_shown',{...surface,feedback:'alert'})
    }
  }
  const onVisibility = () => {
    if(doc.visibilityState==='hidden') {summary('page_hidden');analytics.leaveAttempts();forms.clear()}
    lastTick=clock()
  }
  const onPageHide = () => {summary('page_hidden');analytics.leaveAttempts()}
  for(const name of ['click','change','input','submit','invalid'])doc.addEventListener(name,event,true)
  doc.addEventListener('visibilitychange',onVisibility);win.addEventListener('pagehide',onPageHide)
  let pendingFrame: number | undefined
  const observer = new win.MutationObserver(() => {
    // Revoke context immediately; expensive feedback scanning is coalesced.
    if(!canCapture())forget()
    if(pendingFrame!==undefined)return
    pendingFrame=win.requestAnimationFrame(()=>{pendingFrame=undefined;feedback()})
  })
  observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-hidden','open','style']})
  let performanceObserver: PerformanceObserver | undefined
  try {
    performanceObserver = new win.PerformanceObserver(list => {
      if(!sync())return
      for(const entry of list.getEntries()) if(entry.startTime>=routeStarted && entry.duration>=50) analytics.capture('performance_measured',{...surface,metric:'long_task',duration_ms:Math.min(86400000,Math.round(entry.duration))})
    })
    performanceObserver.observe({type:'longtask',buffered:false})
  } catch { /* Unsupported browser: no invented performance results. */ }
  const tick = win.setInterval(()=>{if(sync()&&clock()-started>=30000){summary('interval');started=clock()}},1000)
  const unsubscribe=analytics.subscribe(feedback)
  feedback()
  return () => {
    stopped=true;win.clearInterval(tick);if(pendingFrame!==undefined)win.cancelAnimationFrame(pendingFrame);if(frame!==undefined)win.cancelAnimationFrame(frame);observer.disconnect();performanceObserver?.disconnect();unsubscribe();forget()
    for(const name of ['click','change','input','submit','invalid'])doc.removeEventListener(name,event,true)
    doc.removeEventListener('visibilitychange',onVisibility);win.removeEventListener('pagehide',onPageHide)
  }
}
