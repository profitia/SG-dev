"use client";

import React, { useEffect, useRef, useState, type RefObject } from "react";

export type ReportNavigationItem = { id: string; label: string };
type SectionStart = { id: string; top: number };

/** Layout is measured on content changes; scrolling only compares cached boundaries. */
export function currentReportSection(starts: readonly SectionStart[], marker: number, current: string, atEnd = false): string {
  if (!starts.length) return "";
  if (atEnd) return starts[starts.length - 1].id;
  let index = 0;
  for (let i = 1; i < starts.length; i++) if (starts[i].top <= marker) index = i;
  const previous = starts.findIndex(section => section.id === current);
  // A small dead band prevents flicker when a heading sits on the sticky boundary.
  if (previous >= 0 && previous !== index) {
    if (previous < index && starts[index].top > marker - 12) return current;
    if (previous > index && starts[previous].top < marker + 12) return current;
  }
  return starts[index].id;
}

const highlights = new WeakMap<HTMLElement, number>();
export function navigateReportSection(root: HTMLElement, id: string): boolean {
  const target = Array.from(root.querySelectorAll<HTMLElement>("[id]")).find(element => element.id === id);
  if (!target) return false;
  let ancestor: HTMLElement | null = target;
  while (ancestor && ancestor !== root) {
    if (ancestor.tagName === "DETAILS") (ancestor as HTMLDetailsElement).open = true;
    ancestor = ancestor.parentElement;
  }
  const focusTarget = target.querySelector<HTMLElement>(":scope > summary") ?? target.querySelector<HTMLElement>("h2") ?? target;
  if (!focusTarget.matches("summary, button, a, input, select, [tabindex]")) focusTarget.tabIndex = -1;
  focusTarget.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "auto", block: "start" });
  for (const previous of root.querySelectorAll<HTMLElement>("[data-navigation-target]")) {
    window.clearTimeout(highlights.get(previous));
    previous.removeAttribute("data-navigation-target");
  }
  target.dataset.navigationTarget = "true";
  highlights.set(target, window.setTimeout(() => {
    target.removeAttribute("data-navigation-target"); highlights.delete(target);
  }, 1500));
  return true;
}

export function ReportNavigation({ root, items }: { root: RefObject<HTMLDivElement | null>; items: readonly ReportNavigationItem[] }) {
  const navigation = useRef<HTMLElement>(null);
  const [active, setActive] = useState(items[0]?.id ?? "");
  const activeRef = useRef(active);
  const ids = items.map(item => item.id).join("|");
  useEffect(() => {
    const container = root.current, nav = navigation.current;
    if (!container || !nav) return;
    const sections = ids.split("|").map(id => Array.from(container.querySelectorAll<HTMLElement>("[id]")).find(node => node.id === id)).filter((node): node is HTMLElement => !!node);
    let starts: SectionStart[] = [], offset = 0, reportEnd = 0, frame = 0, needsMeasure = true;
    const update = () => {
      frame = 0;
      if (needsMeasure) {
        starts = sections.map(node => ({ id: node.id, top: node.getBoundingClientRect().top + window.scrollY }));
        offset = nav.getBoundingClientRect().height + 20;
        reportEnd = container.getBoundingClientRect().bottom + window.scrollY;
        container.style.setProperty("--report-scroll-offset", `${offset}px`);
        needsMeasure = false;
      }
      const atEnd = window.scrollY > 0 && window.scrollY + window.innerHeight >= reportEnd - 2;
      const next = currentReportSection(starts, window.scrollY + offset, activeRef.current, atEnd);
      if (next !== activeRef.current) { activeRef.current = next; setActive(next); }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const remeasure = () => { needsMeasure = true; schedule(); };
    const observer = new ResizeObserver(remeasure);
    for (const node of [container, nav, ...sections]) observer.observe(node);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    container.addEventListener("toggle", remeasure, true);
    remeasure();
    return () => {
      observer.disconnect(); window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", remeasure);
      container.removeEventListener("toggle", remeasure, true);
      container.style.removeProperty("--report-scroll-offset");
    };
  }, [ids, root]);
  const selected = items.some(item => item.id === active) ? active : items[0]?.id ?? "";
  function go(id: string) {
    if (root.current && navigateReportSection(root.current, id)) { activeRef.current = id; setActive(id); }
  }
  return <nav ref={navigation} className="report-navigation" aria-label="Sekcje raportu">
    <div className="report-navigation-desktop">{items.map(item => <a key={item.id} href={`#${item.id}`}
      aria-current={selected === item.id ? "location" : undefined} onClick={event => { event.preventDefault(); go(item.id); }}>{item.label}</a>)}</div>
    <label className="report-navigation-mobile">Sekcja raportu<select aria-label="Przejdź do sekcji" value={selected} onChange={event => go(event.target.value)}>
      {items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
  </nav>;
}
