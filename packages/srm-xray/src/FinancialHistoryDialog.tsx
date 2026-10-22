"use client";
import React, { useRef, useId, useLayoutEffect } from 'react';
import { CanonElement, CanonButton, CanonCloseButton } from './ui-canon';
export function FinancialHistoryDialog({
  title,
  subtitle,
  children,
  onClose,
  actions,
  className = "",
  compact = false
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  useLayoutEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let clipped: {
      top: number;
      height: number;
    } | null = null;
    const center = () => {
      const v = window.visualViewport,
        top = Math.max(v?.offsetTop ?? 0, clipped?.top ?? 0),
        bottom = Math.min((v?.offsetTop ?? 0) + (v?.height ?? window.innerHeight), clipped ? clipped.top + clipped.height : Infinity),
        h = bottom - top;
      if (h < 100) return;
      dialog.current?.style.setProperty('--srm-history-center', `${top + h / 2}px`);
      dialog.current?.style.setProperty('--srm-history-height', `${Math.min(compact ? 650 : 720, h - 32)}px`);
    };
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRect.height > 100) {
        clipped = {
          top: e.intersectionRect.top,
          height: e.intersectionRect.height
        };
        center();
      }
    }, {
      threshold: Array.from({
        length: 101
      }, (_, i) => i / 100)
    });
    if (window.self !== window.top) observer.observe(document.querySelector('.srm-ui') ?? document.body);
    center();
    node?.showModal();
    node?.querySelector<HTMLButtonElement>(".srm-close-window")?.focus();
    window.addEventListener('resize', center);
    window.visualViewport?.addEventListener('resize', center);
    window.visualViewport?.addEventListener('scroll', center);
    return () => {
      observer.disconnect();
      document.body.style.overflow = overflow;
      window.removeEventListener('resize', center);
      window.visualViewport?.removeEventListener('resize', center);
      window.visualViewport?.removeEventListener('scroll', center);
      node?.close();
      if (previous?.isConnected) previous.focus({
        preventScroll: true
      });
    };
  }, [compact]);
  return <CanonElement as="dialog" canonId="SRM-C27" usage="FinancialHistoryDialog:01" ref={dialog} aria-labelledby={id} className={'srm-ui srm-history srm-history-detail srm-statement-dialog' + (compact ? ' is-picker' : '') + ' ' + className } onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, iframe, [tabindex="0"]'))
      .filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={e => {
    e.preventDefault();
    onClose();
  }} onClick={e => {
    if (e.target === e.currentTarget) {
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
    }
  }}>
 <header className="srm-history-detail-head"><div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><div className="srm-history-head-actions">{actions}<CanonCloseButton canonId="SRM-C60" usage="FinancialHistoryDialog:02" onClick={onClose} /></div></header>{children}</CanonElement>;
}