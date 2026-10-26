import {usePresentationScope} from '../../PresentationScope';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CanonButton, CanonElement, CanonSelect } from './CanonElements';
import { sideMenuCanon, sideMenuVariables } from './side-menu-contract';

type MenuEdge = 'left' | 'right' | 'top' | 'bottom';
const edgeNames = {
  left: 'Lewa krawędź',
  right: 'Prawa krawędź',
  top: 'Górna krawędź',
  bottom: 'Dolna krawędź'
};
export function CanonDockGlyph({
  index = 0,
  size = 24,
  stroke = 1.6
}: {
  index?: number;
  size?: number;
  stroke?: number;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden="true">{[[4, 4], [14, 4], [4, 14], [14, 14]].map(([x, y], i) => <rect key={i} x={x} y={y} width="6" height="6" rx="1.8" fill={i === index % 4 ? 'currentColor' : 'none'} />)}</svg>;
}
export function CanonMenuChevron({
  direction = 'right',
  size = 16,
  stroke = 1.6
}: {
  direction?: 'left' | 'right' | 'up' | 'down';
  size?: number;
  stroke?: number;
}) {
  const angle = {
    right: 0,
    down: 90,
    left: 180,
    up: 270
  }[direction];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" transform={`rotate(${angle} 12 12)`} /></svg>;
}
export function CanonUserGlyph({
  size = 24,
  stroke = 1.6
}: {
  size?: number;
  stroke?: number;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>;
}
export function CanonSideMenu({
  children,
  contained = false,
  defaultOpen = false,
  userName = 'Adam Kowalski',
  items = sideMenuCanon.demoItems,
  onNavigate,
  defaultActive = 'Dostawcy'
}: {
  children: React.ReactNode;
  contained?: boolean;
  defaultOpen?: boolean;
  userName?: string;
  items?: readonly string[];
  onNavigate?: (label: string) => void;
  defaultActive?: string;
}) {
 const document=usePresentationScope().document;

  const [open, setOpen] = useState(defaultOpen);
  const [pinned, setPinned] = useState(false);
  const [active, setActive] = useState(defaultActive);
  const [top, setTop] = useState(0);
  const [edge, setEdge] = useState<MenuEdge>('left');
  const [moving, setMoving] = useState(false);
  const [dockHeight, setDockHeight] = useState(112);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const horizontal = edge === 'top' || edge === 'bottom';
  const arrowDirection = ({
    left: open ? 'left' : 'right',
    right: open ? 'right' : 'left',
    top: open ? 'up' : 'down',
    bottom: open ? 'down' : 'up'
  } as const)[edge];
  const changeEdge = (next: MenuEdge) => {
    if (next === edge) return;
    if (moveTimer.current) clearTimeout(moveTimer.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEdge(next);
      setMoving(false);
      return;
    }
    setMoving(true);
    moveTimer.current = setTimeout(() => {
      setEdge(next);
      requestAnimationFrame(() => requestAnimationFrame(() => setMoving(false)));
    }, 160);
  };
  useEffect(() => () => {
    if (moveTimer.current) clearTimeout(moveTimer.current);
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setDockHeight(Math.ceil(entries[0].target.getBoundingClientRect().height)));
    if (panel.current) observer.observe(panel.current);
    return () => observer.disconnect();
  }, []);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pinButton = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setPinned(false);
    if (returnFocus) requestAnimationFrame(() => trigger.current?.focus({
      preventScroll: true
    }));
  }, []);
  const reveal = () => {
    setOpen(true);
    requestAnimationFrame(() => pinButton.current?.focus({
      preventScroll: true
    }));
  };
  useEffect(() => {
    if (contained) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const chrome = document.querySelector<HTMLElement>('.canon-studio-bar');
        const chromeBottom = chrome && getComputedStyle(chrome).display !== 'none' ? chrome.getBoundingClientRect().bottom : 0;
        setTop(Math.max(0, chromeBottom, root.current?.getBoundingClientRect().top ?? 0));
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, {
      passive: true
    });
    const observer = new ResizeObserver(measure);
    if (root.current?.parentElement) observer.observe(root.current.parentElement);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [contained]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (pinned || panel.current?.contains(e.target as Node) || trigger.current?.contains(e.target as Node)) return;
      if (contained && !root.current?.contains(e.target as Node)) return;
      // Do not prevent the underlying action or move the user's scroll position.
      close(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pinned && (!contained || root.current?.contains(document.activeElement))) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, pinned, contained, close]);
  return <div ref={root} className={'srm-side-menu-shell' + (contained ? ' is-contained' : '') + (open ? ' is-open' : '') + (pinned ? ' is-pinned' : '') + (horizontal ? ' is-horizontal' : '') + (moving ? ' is-moving' : '')} style={{
    ...sideMenuVariables,
    '--side-menu-top': `${top}px`,
    '--side-menu-height': `${dockHeight}px`
  } as React.CSSProperties} data-menu-state={!open ? 'closed' : pinned ? 'pinned' : 'open'} data-menu-edge={edge}>
    <div className="srm-side-menu-content">{children}</div>
    <div className="srm-side-menu-clip">
      <CanonElement as="aside" canonId="SRM-C64" usage="CanonSideMenu:panel" ref={panel} id={panelId} className="srm-side-menu-panel" aria-label="Menu główne" aria-hidden={!open} inert={!open ? true : undefined}>
        <header className="srm-side-menu-head"><span className="srm-side-menu-eyebrow">TWOJA PRZESTRZEŃ</span><strong>Menu</strong><div className="srm-side-menu-actions">
          <CanonButton canonId="SRM-C66" usage="CanonSideMenu:pin" ref={pinButton} type="button" aria-pressed={pinned} onClick={() => setPinned(!pinned)}>{pinned ? 'Odepnij' : 'Przypnij'}</CanonButton>
        </div><label className="srm-side-menu-position"><span>Pozycja</span><CanonSelect canonId="SRM-C69" usage="CanonSideMenu:position" aria-label="Pozycja menu" value={edge} onChange={event => changeEdge(event.target.value as MenuEdge)}>{(Object.entries(edgeNames) as [MenuEdge, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</CanonSelect></label></header>
        <nav className="srm-side-menu-items" aria-label="Pozycje menu — podgląd"><span className="srm-side-menu-caption">SPENDGURU 2.0</span>{items.map((label, index) => horizontal ? <CanonButton canonId="SRM-C70" usage="CanonSideMenu:dock-item" key={label} type="button" disabled={label.startsWith('Should Cost')} aria-label={label} title={label} aria-pressed={active === label} onClick={() => {
            setActive(label);
            onNavigate?.(label);
            if (!pinned) close();
          }}><CanonDockGlyph index={index} /></CanonButton> : <CanonButton canonId="SRM-C68" usage="CanonSideMenu:item" key={label} type="button" disabled={label.startsWith('Should Cost')} aria-pressed={active === label} onClick={() => {
            setActive(label);
            onNavigate?.(label);
            if (!pinned) close();
          }}>{label}</CanonButton>)}</nav>
        <CanonElement as="footer" canonId="SRM-C67" usage="CanonSideMenu:user" className="srm-side-menu-user" title={userName} aria-label={"Twoje konto: " + userName}><span className="srm-side-menu-user-icon"><CanonUserGlyph /></span><div><small>Twoje konto</small><strong>{userName}</strong></div></CanonElement>
      </CanonElement>
      <span className="srm-menu-sr" role="status" aria-live="polite">{open ? `Menu: ${edgeNames[edge]}. ${pinned ? "Przypięte." : "Nieprzypięte."}` : "Menu schowane."}</span>
      <CanonButton canonId="SRM-C65" usage="CanonSideMenu:trigger" ref={trigger} type="button" className="srm-side-menu-trigger" aria-expanded={open} aria-controls={panelId} aria-label={open ? "Zwiń menu" : "Rozwiń menu"} title={open ? "Zwiń menu" : "Rozwiń menu"} onClick={() => open ? close() : reveal()}><span className="srm-menu-ribbon-symbol"><CanonDockGlyph size={19} /></span><CanonMenuChevron direction={arrowDirection} /></CanonButton>
    </div>
  </div>;
}
