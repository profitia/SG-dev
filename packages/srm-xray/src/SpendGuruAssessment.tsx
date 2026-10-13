"use client";
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDetachedAssistantWindow } from './useDetachedAssistantWindow';
import type { AssistantApplicationContext } from './assistant-context';
type Props = {
  context: AssistantApplicationContext;
  avatars: { male: string; anna: string };
  year: number | null;
  company: string;
  values: (number | null)[];
  formatted: string[];
};
// Canonical financial-summary template v1: deterministic source values only.
// Missing values remain explicit; this view makes no model calls or simulated replies.
function summaryPLN(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'brak danych';
  return value.toLocaleString('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' PLN';
}
function ChatIcon({
  kind
}: {
  kind: 'clock' | 'more' | 'collapse' | 'expand' | 'send' | 'detach' | 'attach';
}) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    {kind === 'more' && <g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></g>}
    {kind === 'collapse' && <path d="m9 6 6 6-6 6" />}
    {kind === 'expand' && <path d="m15 6-6 6 6 6" />}
    {kind === 'detach' && <><path d="M14 4h6v6M20 4l-9 9" /><path d="M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" /></>}
    {kind === 'attach' && <><path d="M9 5H5v14h14v-4M20 4l-9 9M11 7v6h6" /></>}
    {kind === 'send' && <><path d="m5 12 7-7 7 7M12 5v14" /></>}
  </svg>;
}
export function SpendGuruAssessment({
  context,
  avatars,
  year,
  company,
  values,
  formatted
}: Props) {
  // Conversation state survives reparenting; both presentations share this owner.
  const [draft, setDraft] = useState('');
  const [persona, setPersona] = useState<'male' | 'anna'>('male');
  const [collapsed, setCollapsed] = useState(false);
  const [avatarPulse, setAvatarPulse] = useState<'expanded' | 'collapsed' | null>(null);
  const pendingAvatarPulse = useRef<'expanded' | 'collapsed' | null>(null);
  const [popup, setPopup] = useState<'avatar' | 'history' | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const historyTrigger = useRef<HTMLButtonElement>(null);
  const popupFirst = useRef<HTMLButtonElement>(null);
  const collapseTrigger = useRef<HTMLButtonElement>(null);
  const expandTrigger = useRef<HTMLButtonElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const initialMessage = useRef<HTMLElement>(null);
  const previousCollapsed = useRef(false);
  const detachTrigger = useRef<HTMLButtonElement>(null);
  const windowHost = useDetachedAssistantWindow(() => {
    setPopup(null);
    setCollapsed(false);
    setAnnouncement('Asystent wrócił do dashboardu.');
    window.requestAnimationFrame(() => detachTrigger.current?.focus({
      preventScroll: true
    }));
  });
  const indicatorYears = [...new Set(context.view.indicators.items.map(item => item.year).filter(year => year !== null))];
  const contextLabel = `${context.view.indicators.label}${indicatorYears.length === 1 ? ' · ' + indicatorYears[0] : indicatorYears.length > 1 ? ' · różne lata' : ''}`;
  const id = useId();
  const nextPersona = persona === 'male' ? 'anna' : 'male';
  const actionLabel = persona === 'male' ? 'Zamień na Annę' : 'Zamień na wersję męską';
  const avatarAlt = persona === 'anna' ? 'Anna — asystentka SpendGuru' : 'Asystent SpendGuru';
  const motion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' as const : 'smooth' as const;
  const toggleAssistant = (nextCollapsed: boolean) => {
    setPopup(null);
    setAvatarPulse(null);
    pendingAvatarPulse.current = motion() === 'auto' ? null : nextCollapsed ? 'collapsed' : 'expanded';
    setCollapsed(nextCollapsed);
  };
  // Pulse only after the visible panel/ribbon finishes sliding, never on initial render.
  const finishSlide = (event: React.TransitionEvent<HTMLElement>, destination: 'expanded' | 'collapsed') => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    if (pendingAvatarPulse.current !== destination || collapsed !== (destination === 'collapsed')) return;
    pendingAvatarPulse.current = null;
    if (motion() !== 'auto') setAvatarPulse(destination);
  };
  const finishAvatarPulse = (event: React.AnimationEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && event.animationName === 'srm-avatar-arrival') setAvatarPulse(null);
  };
  useEffect(() => {
    if (panel.current) panel.current.inert = collapsed;
    if (previousCollapsed.current !== collapsed) {
      (collapsed ? expandTrigger : collapseTrigger).current?.focus({
        preventScroll: true
      });
      previousCollapsed.current = collapsed;
    }
  }, [collapsed, windowHost.target]);
  useEffect(() => {
    if (!popup) return;
    popupFirst.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!controls.current?.contains(event.target as Node)) setPopup(null);
    };
    const ownerDocument = controls.current?.ownerDocument || document;
    ownerDocument.addEventListener('pointerdown', closeOutside);
    return () => ownerDocument.removeEventListener('pointerdown', closeOutside);
  }, [popup, windowHost.target]);
  const summaryValue = (index: number) => values[index] == null || !Number.isFinite(values[index]) ? 'brak danych' : formatted[index];
  const jumpTo = () => {
    setPopup(null);
    const target = initialMessage.current;
    if (target && transcript.current) {
      const offset = target.getBoundingClientRect().top - transcript.current.getBoundingClientRect().top;
      transcript.current.scrollTo({
        top: transcript.current.scrollTop + offset - 14,
        behavior: motion()
      });
      target.focus({
        preventScroll: true
      });
    }
  };
  const chat = <>
    <div ref={panel} id={`${id}-panel`} className="srm-chat-motion" aria-hidden={collapsed || undefined} onTransitionEnd={event => finishSlide(event, 'expanded')}>
      {!windowHost.detached && <button ref={collapseTrigger} type="button" className="srm-chat-collapse" onClick={() => toggleAssistant(true)} aria-label="Zwiń asystenta do prawej krawędzi" title="Zwiń asystenta" aria-expanded={!collapsed} aria-controls={`${id}-panel`}><ChatIcon kind="collapse" /></button>}
      <div className="srm-chat-window">
        <header className="srm-chat-header">
          <div className="srm-chat-greeting"><h3>Cześć! Jestem SpendGuru, {persona === 'anna' ? 'twoja doradczyni' : 'twój doradca'}</h3></div>
          <div className="srm-chat-tools" ref={controls} onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPopup(null);
          }} onKeyDown={event => {
            if (event.key === 'Escape' && popup) {
              event.preventDefault();
              (popup === 'avatar' ? menuTrigger : historyTrigger).current?.focus();
              setPopup(null);
            }
          }}>
            <button ref={detachTrigger} className="srm-chat-tool" type="button" aria-label={windowHost.detached ? 'Przyłącz czat do dashboardu' : 'Otwórz czat w osobnym oknie'} title={windowHost.detached ? 'Przyłącz do dashboardu' : 'Otwórz w osobnym oknie'} onClick={() => {
              setPopup(null);
              setAvatarPulse(null);
              pendingAvatarPulse.current = null;
              if (windowHost.detached) windowHost.attach();else windowHost.detach();
            }}><ChatIcon kind={windowHost.detached ? 'attach' : 'detach'} /></button>
            <button ref={historyTrigger} className="srm-chat-tool" type="button" aria-label="Historia rozmowy" title="Historia rozmowy" aria-expanded={popup === 'history'} aria-controls={popup === 'history' ? `${id}-history` : undefined} onClick={() => setPopup(p => p === 'history' ? null : 'history')}><ChatIcon kind="clock" /></button>
            <button ref={menuTrigger} className="srm-chat-tool" type="button" aria-label="Zmień awatar SpendGuru" title="Zmień awatar" aria-haspopup="menu" aria-expanded={popup === 'avatar'} onClick={() => setPopup(p => p === 'avatar' ? null : 'avatar')} onKeyDown={event => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setPopup('avatar');
              }
            }}><ChatIcon kind="more" /></button>
            {popup === 'avatar' && <div className="srm-chat-popover srm-chat-avatar-menu" role="menu" aria-label="Wybór awatara" onKeyDown={event => {
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                popupFirst.current?.focus();
              }
            }}>
              <button ref={popupFirst} type="button" role="menuitem" onClick={() => {
                setPersona(nextPersona);
                setPopup(null);
                setAnnouncement(nextPersona === 'anna' ? 'Wybrano Annę.' : 'Wybrano wersję męską.');
                menuTrigger.current?.focus();
              }}><span className="srm-chat-mini-avatar"><img src={avatars[nextPersona]} alt="" /></span>{actionLabel}</button>
            </div>}
            {popup === 'history' && <div className="srm-chat-popover srm-chat-history" id={`${id}-history`} role="region" aria-label="Historia bieżącej rozmowy"><h4>Historia rozmowy</h4><p>Bieżąca sesja</p><button ref={popupFirst} type="button" onClick={() => jumpTo()}><span>Podsumowanie danych</span><small>{company} · {year}</small></button></div>}
          </div>
        </header>
        <div className="srm-chat-context" aria-label="Bieżący kontekst dashboardu">
          <span>{windowHost.detached ? 'Połączony z dashboardem' : 'Kontekst dashboardu'}</span>
          <details><summary>Radar {year}{context.view.radar.comparisonYear ? ' / ' + context.view.radar.comparisonYear : ''} · {contextLabel}</summary>
            <div className="srm-chat-context-detail"><strong>{context.supplier.name}</strong>
              <p>Radar: {year}{context.view.radar.comparisonYear ? ' · porównanie z ' + context.view.radar.comparisonYear : ''}</p>
              <p>Odniesienie: {context.view.radar.referenceSelection === 'auto' ? 'automatyczne' : context.view.radar.referenceKind === 'peers' ? 'benchmark dostawców' : 'najlepsze historyczne'}{context.view.radar.referenceStatus === 'unconfirmed' ? ' · wymaga potwierdzenia' : ''}</p>
              <p>Wskaźniki: {context.view.indicators.label}</p>
              <ul>{context.view.indicators.items.map(item => <li key={item.code}>{item.name} · {item.year ?? 'brak okresu'}{item.availability === 'missing' ? ' · brak danych' : ''}</li>)}</ul>
              {context.view.history && <p>Otwarta historia: {[...context.financialSummary, ...context.view.indicators.items].find(item => item.code === context.view.history?.code)?.name || 'wybrany wskaźnik'} · {context.view.history.year}</p>}
            </div>
          </details>
        </div>
        {windowHost.error && <p className="srm-chat-window-error" role="alert">{windowHost.error}</p>}
        <div className="srm-chat-transcript" ref={transcript} role="region" aria-label="Podsumowanie danych finansowych dostawcy" tabIndex={0}>
          <div className="srm-chat-intro">
            <div className={`srm-chat-avatar${avatarPulse === 'expanded' ? ' is-pulsing' : ''}`} onAnimationEnd={finishAvatarPulse}><img src={avatars[persona]} alt={avatarAlt} width={96} height={96} /></div>
            <div className="srm-chat-intro-copy"><span>PRZYJRZYJMY SIĘ DOSTAWCY</span><strong>{company}</strong><small>{year ? `Wybrane dane finansowe za ${year}` : "Brak dostępnego okresu finansowego"}</small></div>
          </div>
          <article className="srm-chat-message is-assistant srm-chat-analysis" ref={initialMessage} tabIndex={-1}>
            <p>{year ? <>Przyjrzyjmy się danym za <strong>{year}</strong>. </> : null}Przychody wynoszą <strong>{summaryPLN(values[1])}</strong>, a wynik netto to <strong>{summaryPLN(values[0])}</strong>.</p>
            <p>Płynność bieżąca: <strong>{summaryValue(2)}</strong>. Marża operacyjna: <strong>{summaryValue(3)}</strong>. Udział zobowiązań i rezerw w aktywach: <strong>{summaryValue(5)}</strong>.</p>
          </article>
        </div>
        <form className="srm-chat-composer" onSubmit={event => event.preventDefault()}>
          <label htmlFor={`${id}-input`}>O co chcesz zapytać?</label>
          <div className="srm-chat-input-wrap"><textarea id={`${id}-input`} rows={2} placeholder="Napisz wiadomość…" aria-describedby={`${id}-hint`} value={draft} onChange={event => setDraft(event.target.value)} /><button type="submit" aria-label="Wyślij wiadomość" title="Wyślij wiadomość" disabled><ChatIcon kind="send" /></button></div>
          <div className="srm-chat-composer-meta" id={`${id}-hint`}><span>Możesz przygotować pytanie. Wysyłanie do doradcy będzie dostępne w kolejnym etapie.</span></div>
        </form>
      </div>
    </div>
    {!windowHost.detached && <button ref={expandTrigger} className="srm-chat-ribbon" type="button" tabIndex={collapsed ? 0 : -1} aria-hidden={!collapsed || undefined} aria-label="Rozwiń asystenta SpendGuru" title="Rozwiń asystenta" aria-expanded={!collapsed} aria-controls={`${id}-panel`} onClick={() => toggleAssistant(false)} onTransitionEnd={event => finishSlide(event, 'collapsed')}><span className={`srm-chat-ribbon-avatar${avatarPulse === 'collapsed' ? ' is-pulsing' : ''}`} onAnimationEnd={finishAvatarPulse}><img src={avatars[persona]} alt="" /></span><ChatIcon kind="expand" /></button>}
    <span className="srm-sr-only" role="status">{announcement}</span>
  </>;
  return <>
    <section className={`srm-chat-slot${collapsed ? ' is-collapsed' : ''}${windowHost.detached ? ' is-detached' : ''}`} aria-label="Asystent SpendGuru">
      {windowHost.target ? <div className="srm-chat-detached-ribbon">
        <span className="srm-chat-ribbon-avatar"><img src={avatars[persona]} alt="" /></span>
        <span className="srm-chat-detached-caption">Czat w osobnym oknie</span>
        <button className="srm-text-link" type="button" onClick={windowHost.focus}>Pokaż okno</button>
        <button type="button" className="srm-chat-attach-button" onClick={windowHost.attach} aria-label="Przyłącz czat do dashboardu" title="Przyłącz do dashboardu"><ChatIcon kind="attach" /></button>
      </div> : chat}
    </section>
    {windowHost.target && createPortal(<div className="srm-ui srm-detached-shell"><section className="srm-chat-slot is-window" aria-label="Asystent SpendGuru w osobnym oknie">{chat}</section></div>, windowHost.target)}
  </>;
}