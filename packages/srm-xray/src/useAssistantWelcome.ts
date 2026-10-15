"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createWelcomeSequence, resumesFollowing, welcomeScrollTop, type WelcomePhase } from './chat-welcome-contract';

export function useAssistantWelcome(supplierId: string, enabled: boolean, collapsed: boolean, host: HTMLElement | null, transcript: RefObject<HTMLDivElement | null>) {
  const [message, setMessage] = useState({ supplierId, phase: 'idle' as WelcomePhase });
  const [hasUnreadWelcome, setHasUnreadWelcome] = useState(false);
  const welcomeRow = useRef<HTMLDivElement>(null);
  const sequence = useRef<ReturnType<typeof createWelcomeSequence> | null>(null);
  const following = useRef(true);
  const manualScroll = useRef(false);
  const previousScrollTop = useRef(0);
  const phase = enabled && message.supplierId === supplierId ? message.phase : 'idle';

  useEffect(() => {
    setMessage({ supplierId, phase: 'idle' });
    setHasUnreadWelcome(false);
    following.current = true;
    manualScroll.current = false;
    transcript.current?.scrollTo({ top: 0, behavior: 'auto' });
    const current = createWelcomeSequence(phase => setMessage({ supplierId, phase }));
    sequence.current = current;
    return () => current.dispose();
  }, [supplierId, enabled, transcript]);

  useEffect(() => {
    const container = transcript.current;
    if (!enabled || collapsed || !container) return;
    // Use the window hosting the chat, including when reparented to the detached window.
    const view = container.ownerDocument.defaultView;
    if (!view) return;
    const observer = new view.IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        sequence.current?.start();
        observer.disconnect();
      }
    }, { threshold: 0.2 });
    observer.observe(container);
    return () => observer.disconnect();
  }, [supplierId, enabled, collapsed, host, transcript]);

  const revealWelcome = useCallback(() => {
    const container = transcript.current, row = welcomeRow.current;
    if (!container || !row) return;
    following.current = true;
    manualScroll.current = false;
    setHasUnreadWelcome(false);
    const rowTop = row.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({
      top: welcomeScrollTop(rowTop, row.offsetHeight, container.clientHeight, container.scrollHeight),
      behavior: container.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [transcript]);
  useEffect(() => {
    if (phase === 'idle' || collapsed) return;
    if (!following.current) {
      if (phase === 'visible') setHasUnreadWelcome(true);
      return;
    }
    const view = transcript.current?.ownerDocument.defaultView;
    const frame = view?.requestAnimationFrame(() => {
      if (following.current) revealWelcome();
      else if (phase === 'visible') setHasUnreadWelcome(true);
    });
    return () => { if (frame !== undefined) view?.cancelAnimationFrame(frame); };
  }, [phase, collapsed, host, revealWelcome, transcript]);

  const userScrollIntent = () => {
    manualScroll.current = true;
    following.current = false;
    const container = transcript.current;
    if (container) {
      // Cancel an in-flight smooth reveal before the user's wheel/key/drag takes over.
      previousScrollTop.current = container.scrollTop;
      container.scrollTo({ top: container.scrollTop, behavior: 'auto' });
    }
  };
  const trackConversationScroll = () => {
    const container = transcript.current;
    if (!container || !manualScroll.current) return;
    following.current = resumesFollowing(previousScrollTop.current, container.scrollTop, container.clientHeight, container.scrollHeight);
    previousScrollTop.current = container.scrollTop;
    if (following.current) setHasUnreadWelcome(false);
  };
  return { phase, welcomeRow, hasUnreadWelcome: enabled && hasUnreadWelcome, revealWelcome, userScrollIntent, trackConversationScroll };
}
