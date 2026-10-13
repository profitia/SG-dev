import { useCallback, useEffect, useRef, useState } from 'react';

/** Same-origin presentation window: React retains one state owner in the dashboard.
 * No financial data, credentials or session tokens are placed in window URLs.
 * A future independent route can replace this host without changing context types.
 * Closing/reloading the dashboard ends this presentation session.
 */
export function useDetachedAssistantWindow(onReturn: () => void) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const child = useRef<Window | null>(null);
  const interval = useRef<number | null>(null);
  const onReturnRef = useRef(onReturn);
  onReturnRef.current = onReturn;
  const windowName = useRef<string | null>(null);

  const restore = useCallback(() => {
    if (interval.current !== null) window.clearInterval(interval.current);
    interval.current = null;
    child.current = null;
    setTarget(null);
    onReturnRef.current();
  }, []);

  const attach = useCallback(() => {
    const previous = child.current;
    restore();
    if (previous && !previous.closed) previous.close();
    window.focus();
  }, [restore]);

  const focus = useCallback(() => {
    if (child.current && !child.current.closed) child.current.focus();
    else restore();
  }, [restore]);

  const detach = useCallback(() => {
    if (child.current && !child.current.closed) {
      child.current.focus();
      return;
    }
    setError('');
    // Must stay synchronous with the click, otherwise popup blockers reject it.
    let next: Window | null = null;
    try {
      windowName.current ??= 'spendguru-' + crypto.randomUUID();
      next = window.open('', windowName.current, 'popup=yes,width=600,height=820,resizable=yes,scrollbars=yes');
      if (!next || next.closed) throw new Error('Popup unavailable');
      const doc = next.document;
      doc.documentElement.lang = 'pl';
      doc.documentElement.className = document.documentElement.className;
      const base = doc.createElement('base');
      base.href = document.baseURI;
      const viewport = doc.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1';
      doc.head.replaceChildren(base, viewport);
      doc.title = 'SpendGuru — doradca dostawcy';
      document.querySelectorAll('style, link[rel="stylesheet"], link[rel="icon"]').forEach(node => {
        doc.head.appendChild(node.cloneNode(true));
      });
      doc.body.style.margin = '0';
      doc.body.style.display = 'block';
      doc.body.style.width = '100%';
      doc.body.style.overflow = 'hidden';
      const root = doc.createElement('div');
      root.id = 'spendguru-detached-root';
      root.style.width = '100%';
      root.style.height = '100vh';
      root.style.minWidth = '0';
      doc.body.replaceChildren(root);
      child.current = next;
      setTarget(root);
      // Native close is detected even in browsers that omit pagehide for popups.
      interval.current = window.setInterval(() => {
        if (next?.closed) restore();
      }, 300);
      next.focus();
    } catch {
      if (next && !next.closed) next.close();
      setError('Przeglądarka nie otworzyła okna. Zezwól na wyskakujące okna dla tej strony i spróbuj ponownie. Czat pozostaje tutaj.');
    }
  }, [restore]);

  useEffect(() => {
    const closeChild = () => {
      if (child.current && !child.current.closed) child.current.close();
    };
    window.addEventListener('pagehide', closeChild);
    return () => {
      window.removeEventListener('pagehide', closeChild);
      if (interval.current !== null) window.clearInterval(interval.current);
      closeChild();
    };
  }, []);
  return { target, detached: !!target, error, detach, attach, focus };
}
