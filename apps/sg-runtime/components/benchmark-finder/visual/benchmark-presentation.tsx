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
    const [top, setTop] = useState(() => Math.max(24, 144 - window.scrollY));
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
    useEffect(() => { if (!content.current)
        return; content.current.inert = open && overlay; return () => { if (content.current)
        content.current.inert = false; }; }, [open, overlay]);
    return <div className="srm-ui bf-root bf-visual" data-chat-open={open}><div className="bf-page-region" ref={content}>{children}</div>{!compact && <BenchmarkChat open={open} overlay={overlay} onOpenChange={setOpen}/>}</div>;
}
export function BenchmarkThemeSwitch() {
    const [dark, setDark] = useState(false);
    function choose(next: boolean) { setDark(next); document.documentElement.dataset.benchmarkTheme = next ? 'dark' : 'light'; }
    return <div className="bf-theme-switch" aria-label="Motyw interfejsu"><button type="button" aria-pressed={!dark} onClick={() => choose(false)}>☼ <span>Jasny</span></button><button type="button" aria-pressed={dark} onClick={() => choose(true)}>☾ <span>Ciemny</span></button></div>;
}
