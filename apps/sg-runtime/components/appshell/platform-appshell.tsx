'use client'

import React, { useEffect, useState } from 'react'
import { SpendGuruLogo, PorrLogo } from './appshell-brand'
import {AssistantWidget} from './assistant-widget'
import './platform-appshell.css'

type Props = {
  locale: 'pl' | 'en'
  salutation?: string | null
  assistantAvatar?: 'male' | 'female' | null
  organisationBranding?: 'porr' | null
  onLogout: () => void
  signingOut?: boolean
  onLaunchAdp?: () => void
  moduleActive?: boolean
  moduleWorkspace?: (theme: 'light' | 'dark') => React.ReactNode
}
type IconKind = 'chart' | 'search' | 'table' | 'arrow' | 'sun' | 'moon'
function Icon({ kind, size = 24 }: { kind: IconKind; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={kind === 'chart' || kind === 'search' || kind === 'table' ? 1.6 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'chart' && <><path d="M4 20h16" /><rect x="5" y="12" width="3" height="5" rx="1.5" /><rect x="10.5" y="7" width="3" height="10" rx="1.5" /><rect x="16" y="3" width="3" height="14" rx="1.5" /></>}
    {kind === 'search' && <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>}
    {kind === 'table' && <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M3 14h18M10 9v11" /></>}
    {kind === 'arrow' && <path d="M5 12h14m-5-5 5 5-5 5" />}
    {kind === 'moon' && <path d="M20.4 14.3A8.7 8.7 0 0 1 9.7 3.6 8.7 8.7 0 1 0 20.4 14.3Z" />}
    {kind === 'sun' && <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" /></>}
  </svg>
}

const applications = [
  { key: 'benchmark', name: 'Benchmark Finder', category: 'RYNEK I CENY', description: 'Analizuj benchmarki i koszty zasadne Twoich kategorii.', tags: ['Benchmarki rynkowe', 'Ceny historyczne i prognozy'], kind: 'chart' as const },
  { key: 'xray', name: 'X-Ray Supplier Intelligence', category: 'WIEDZA O DOSTAWCACH', description: 'Poznaj swoich dostawców lepiej, niż oni znają Ciebie.', tags: ['Informacje o firmach', 'Ocena dostawców'], kind: 'search' as const },
  { key: 'adp', name: 'ADP — Arkusz Danych Podstawowych', category: 'DANE OD DOSTAWCÓW', description: 'Zbieraj i organizuj informacje o Twoich dostawcach.', tags: ['Ankiety dostawców', 'Dane podstawowe'], kind: 'table' as const },
]

/** Presentation only. The host owns verified account data and sign-out. */
export function PlatformAppShell({ locale, salutation, assistantAvatar, organisationBranding, onLogout, signingOut = false, onLaunchAdp, moduleActive = false, moduleWorkspace }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const en = locale === 'en'
  useEffect(() => {
    try { setTheme(localStorage.getItem('sg2:appshell-theme:v1') === 'dark' ? 'dark' : 'light') } catch { /* Optional local appearance preference. */ }
  }, [])
  function changeTheme(value: 'light' | 'dark') {
    setTheme(value)
    try { localStorage.setItem('sg2:appshell-theme:v1', value) } catch { /* In-session selection still works. */ }
  }
  const addressed = salutation ? `, ${salutation}` : ''
  const userGreeting = en ? `Good morning${addressed}.` : `Dzień dobry${addressed}.`
  return <div className={`appshell srm-ui${moduleActive ? ' as-module-active' : ''}`} data-theme={theme} style={{ colorScheme: theme }}>
    <a className="as-skip" href="#appshell-main">{en ? 'Skip to applications' : 'Przejdź do aplikacji'}</a>
    <header className="as-header"><div className="as-header-inner">
      <div className="as-brand-group"><div className="as-logo"><SpendGuruLogo width={164} /></div></div>
      <div className="as-account-group">
        <div className="srm-theme-switch" role="group" aria-label={en ? 'Interface theme' : 'Motyw interfejsu'}>
          {(['light', 'dark'] as const).map(value => <button key={value} type="button" aria-pressed={theme === value} onClick={() => changeTheme(value)} title={value === 'light' ? (en ? 'Light theme' : 'Jasny motyw') : (en ? 'Dark theme' : 'Ciemny motyw')}>
            <Icon kind={value === 'light' ? 'sun' : 'moon'} size={16} /><span>{value === 'light' ? (en ? 'Light' : 'Jasny') : (en ? 'Dark' : 'Ciemny')}</span>
          </button>)}
        </div>
        {organisationBranding === 'porr' && <><span className="as-header-divider" /><div className="as-porr"><PorrLogo width="3rem" /></div></>}
        <button className="as-secondary-button as-logout" type="button" onClick={onLogout} disabled={signingOut}>{en ? 'Sign out' : 'Wyloguj'}</button>
      </div>
    </div></header>
    <main id="appshell-main" className="as-main" tabIndex={-1}>
      <div className="as-introduction" hidden={moduleActive}><div><h1>{userGreeting}<br className="as-mobile-break" /> {en ? 'Shall we begin?' : 'Zaczynamy?'}</h1><p>{en ? 'Everything you need in your daily work — in one place.' : 'Wszystko, czego potrzebujesz w codziennej pracy — w jednym miejscu.'}</p></div></div>
      <div className="as-workspace">
        <section key="applications" className="as-applications" hidden={moduleActive} aria-label={en ? 'SpendGuru applications' : 'Aplikacje SpendGuru'}><div className="as-app-stack">
          {applications.map(app => <article className="as-app-card" key={app.key}>
            <div className="as-app-top"><div className="as-app-icon"><Icon kind={app.kind} size={28} /></div></div>
            <div className="as-app-copy"><p className="as-eyebrow">{app.category}</p><h3>{app.name}</h3><p>{app.description}</p></div>
            <div className="as-app-footer"><ul className="as-tags" aria-label={en ? 'Application scope' : 'Zakres aplikacji'}>{app.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
              <button className="as-primary-button as-launch" type="button" disabled={app.key !== 'adp' || !onLaunchAdp} onClick={app.key === 'adp' ? onLaunchAdp : undefined} aria-label={(en ? 'Launch ' : 'Uruchom ') + app.name}>{en ? 'Launch' : 'Uruchom'}<Icon kind="arrow" size={18} /></button>
            </div>
          </article>)}
        </div></section>
        <section key="module" className="as-module-workspace" hidden={!moduleActive}>{moduleWorkspace?.(theme)}</section>
        <section key="assistant" className="as-assistant" aria-label={en ? 'Your assistant' : 'Twój asystent'}>
          <AssistantWidget locale={locale} salutation={salutation} avatar={assistantAvatar} theme={theme}/>
        </section>
      </div>
    </main>
  </div>
}
