"use client";
import React, { useRef, useId, useLayoutEffect } from 'react';
import { CanonElement, CanonButton } from './ui-canon';
export function FinancialHistoryDialog({
  title,
  subtitle,
  children,
  onClose,
  actions,
  compact = false
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  useLayoutEffect(() => {
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
    dialog.current?.showModal();
    window.addEventListener('resize', center);
    window.visualViewport?.addEventListener('resize', center);
    window.visualViewport?.addEventListener('scroll', center);
    return () => {
      observer.disconnect();
      document.body.style.overflow = overflow;
      window.removeEventListener('resize', center);
      window.visualViewport?.removeEventListener('resize', center);
      window.visualViewport?.removeEventListener('scroll', center);
      previous?.focus({
        preventScroll: true
      });
    };
  }, [compact]);
  return <CanonElement as="dialog" canonId="SRM-C27" usage="FinancialHistoryDialog:01" ref={dialog} aria-labelledby={id} className={'srm-ui srm-history srm-history-detail srm-statement-dialog' + (compact ? ' is-picker' : '')} onCancel={e => {
    e.preventDefault();
    onClose();
  }} onClick={e => {
    if (e.target === e.currentTarget) {
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
    }
  }}>
 <header className="srm-history-detail-head"><div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><div className="srm-history-head-actions">{actions}<CanonButton canonId="SRM-C02" usage="FinancialHistoryDialog:02" type="button" className="srm-btn" onClick={onClose} autoFocus>Zamknij</CanonButton></div></header>{children}</CanonElement>;
}