'use client';
import React, { useEffect, useRef, useState } from 'react';
import './benchmark-chat.css';
const CanonButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
    canonId?: string;
    usage?: string;
}>(function VisualButton({ canonId, usage, ...props }, ref) { return <button {...props} ref={ref} data-library-component={canonId} data-canon-usage={usage}/>; });
const CanonTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    canonId?: string;
    usage?: string;
}>(function VisualTextarea({ canonId, usage, ...props }, ref) { return <textarea {...props} ref={ref} data-library-component={canonId} data-canon-usage={usage}/>; });
const CanonElement = React.forwardRef<HTMLElement, {
    as: React.ElementType;
    canonId?: string;
    usage?: string;
    [key: string]: any;
}>(function VisualElement({ as, canonId, usage, ...props }, ref) { return React.createElement(as, { ...props, ref, 'data-library-component': canonId, 'data-canon-usage': usage }); });
const benchmarkChatContract = { id: 'BF-CHAT-01', avatarUrl: '/benchmark-visual/spendguru-avatar.png' };
export function useBenchmarkChatOverlay() {
    const [overlay, setOverlay] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 1179px)');
        const update = () => setOverlay(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    return overlay;
}
function ChatArrow({ open }: {
    open: boolean;
}) {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'}/></svg>;
}
/** Empty design shell: deliberately contains no conversation, API or fake response. */
export function BenchmarkChat({ open, overlay, onOpenChange }: {
    open: boolean;
    overlay: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const showRef = useRef<HTMLButtonElement>(null);
    const hideRef = useRef<HTMLButtonElement>(null);
    const previousOpen = useRef(open);
    const [top, setTop] = useState(() => typeof window === 'undefined' ? 144 : Math.max(24, 144 - window.scrollY));
    useEffect(() => {
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setTop(Math.max(24, 144 - window.scrollY)));
        };
        window.addEventListener('scroll', update, {
            passive: true
        });
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', update);
        };
    }, []);
    useEffect(() => {
        if (previousOpen.current === open)
            return;
        previousOpen.current = open;
        const frame = requestAnimationFrame(() => (open ? hideRef : showRef).current?.focus({
            preventScroll: true
        }));
        return () => cancelAnimationFrame(frame);
    }, [open]);
    useEffect(() => {
        if (!open || !overlay)
            return;
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const frame = requestAnimationFrame(() => hideRef.current?.focus({
            preventScroll: true
        }));
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onOpenChange(false);
            }
            // The empty shell has only one enabled control.
            if (event.key === 'Tab') {
                event.preventDefault();
                hideRef.current?.focus({
                    preventScroll: true
                });
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('keydown', onKeyDown);
            if (previous?.isConnected)
                previous.focus({
                    preventScroll: true
                });
        };
    }, [open, overlay, onOpenChange]);
    return <div className="bf-chat-layer" data-open={open} data-layout={overlay ? 'overlay' : 'docked'} style={{
            '--bf-chat-top': `${top}px`
        } as React.CSSProperties} data-chat-contract={benchmarkChatContract.id}>
    {open && overlay && <div className="bf-chat-backdrop" aria-hidden="true" onClick={() => onOpenChange(false)}/>}
    <CanonButton canonId="SRM-C36" usage="BenchmarkChat:show" type="button" ref={showRef} className="bf-chat-show" aria-label="Pokaż czat SpendGuru" title="Pokaż czat" aria-controls="bf-chat-window" aria-expanded={open} tabIndex={open ? -1 : 0} aria-hidden={open} onClick={() => onOpenChange(true)}>
      <CanonElement as="span" canonId="SRM-C33" usage="BenchmarkChat:ribbon-avatar" className="bf-chat-ribbon-avatar"><img src={benchmarkChatContract.avatarUrl} alt=""/></CanonElement>
      <ChatArrow open={false}/>
    </CanonButton>
    <CanonElement as="aside" canonId="SRM-C31" usage="BenchmarkChat:window" id="bf-chat-window" className="bf-chat-window" role={overlay ? 'dialog' : 'complementary'} aria-modal={open && overlay ? true : undefined} aria-labelledby="bf-chat-title" aria-hidden={!open} inert={!open ? true : undefined} onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Escape' && !overlay) {
                e.preventDefault();
                onOpenChange(false);
            }
        }}>
      <CanonButton canonId="SRM-C37" usage="BenchmarkChat:hide" type="button" ref={hideRef} className="bf-chat-hide" aria-label="Ukryj czat SpendGuru" title="Ukryj czat" aria-controls="bf-chat-window" aria-expanded={open} onClick={() => onOpenChange(false)}><ChatArrow open/></CanonButton>
      <div className="bf-chat-frame">
        <CanonElement as="header" canonId="SRM-C32" usage="BenchmarkChat:header" className="bf-chat-header"><h2 id="bf-chat-title">SpendGuru</h2></CanonElement>
        <div className="bf-chat-body" aria-label="Pusta rozmowa"/>
        <CanonElement as="div" canonId="SRM-C35" usage="BenchmarkChat:composer" className="bf-chat-composer">
          <div className="bf-chat-input-wrap"><CanonTextarea canonId="SRM-C35" usage="BenchmarkChat:input" className="bf-chat-input" aria-label="Pole wiadomości — podgląd wyglądu" placeholder="Napisz wiadomość…" disabled rows={2}/>
          <CanonButton canonId="SRM-C01" usage="BenchmarkChat:send" type="button" className="bf-chat-send" aria-label="Wyślij wiadomość" disabled><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 5v14"/></svg></CanonButton></div>
        </CanonElement>
      </div>
    </CanonElement>
  </div>;
}
/** Layout state only. This shell never requests data or sends chat messages. */
export function BenchmarkPresentation({ children, compact = false }: {
    children: React.ReactNode;
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const overlay = useBenchmarkChatOverlay();
    const content = useRef<HTMLDivElement>(null);
    useEffect(()=>{
        // Theme only, on a separate message type. No tokens, commands or data.
        const frames=()=>Array.from(content.current?.querySelectorAll<HTMLIFrameElement>('iframe[data-testid="benchmark-analytics-embed"]')??[]);
        const send=(frame:HTMLIFrameElement)=>{
            try{frame.contentWindow?.postMessage({type:'profitia.benchmark-theme',version:1,theme:document.documentElement.dataset.srmTheme==='dark'?'dark':'light'},new URL(frame.src).origin)}catch{/* A removed frame has no presentation to update. */}
        };
        const sync=()=>frames().forEach(send);
        const ready=(event:MessageEvent)=>{if(event.data?.type!=='profitia.benchmark-theme.ready'||event.data.version!==1)return;for(const frame of frames())if(event.source===frame.contentWindow&&event.origin===new URL(frame.src).origin)send(frame)};
        const observer=new MutationObserver(sync);
        observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-srm-theme']});
        content.current?.addEventListener('load',sync,true);window.addEventListener('message',ready);sync();
        return()=>{observer.disconnect();content.current?.removeEventListener('load',sync,true);window.removeEventListener('message',ready)};
    },[]);

    useEffect(() => { if (!content.current)
        return; content.current.inert = open && overlay; return () => { if (content.current)
        content.current.inert = false; }; }, [open, overlay]);
    return <div className="srm-ui bf-root bf-visual" data-chat-open={open}><div className="bf-page-region" ref={content}>{children}</div>{!compact && <BenchmarkChat open={open} overlay={overlay} onOpenChange={setOpen}/>}</div>;
}
function ThemeIcon({
  dark
}: {
  dark: boolean;
}) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark ? <path d="M20.4 14.3A8.7 8.7 0 0 1 9.7 3.6 8.7 8.7 0 1 0 20.4 14.3Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" /></>}</svg>;
}
export function BenchmarkThemeSwitch() {
    const [dark, setDark] = useState(false);
    useEffect(()=>setDark(document.documentElement.dataset.srmTheme==='dark'),[]);
    function choose(next: boolean) { setDark(next); document.documentElement.dataset.benchmarkTheme = next ? 'dark' : 'light'; document.documentElement.dataset.srmTheme = next ? 'dark' : 'light'; }
    return <div className="srm-theme-switch" role="group" aria-label="Motyw interfejsu" data-library-component="SRM-C95">{(['light','dark'] as const).map(value=><button key={value} type="button" aria-pressed={dark===(value==='dark')} onClick={()=>choose(value==='dark')} title={value==='light'?'Jasny motyw':'Ciemny motyw'}><ThemeIcon dark={value==='dark'}/><span>{value==='light'?'Jasny':'Ciemny'}</span></button>)}</div>;
}

export function FinderGlyph({kind}:{kind:'search'|'chevron'|'arrow'|'spark'|'clock'|'filter'}) {return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='search'?<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>:kind==='chevron'?<path d="m7 10 5 5 5-5"/>:kind==='arrow'?<path d="M5 12h14m-5-5 5 5-5 5"/>:kind==='clock'?<><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>:kind==='filter'?<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--surface)"/><circle cx="15" cy="17" r="2" fill="var(--surface)"/></>:<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z"/>}</svg>}
