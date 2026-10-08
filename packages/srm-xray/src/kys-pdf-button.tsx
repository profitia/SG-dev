"use client";
import React, { useEffect, useRef, useState } from "react";
import type { KysPdfSelection } from "./kys-pdf-document";

export function KysPdfButton({ selection, onDownload }: { selection: KysPdfSelection;
  onDownload: (selection: KysPdfSelection, signal: AbortSignal) => Promise<void> }) {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  async function download() {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setError(null);
    try { await onDownload(selection, controller.signal); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Nie udało się przygotować PDF. Spróbuj ponownie."); }
    finally { if (!controller.signal.aborted) { active.current = null; setBusy(false); } }
  }
  return <div className="kys-pdf-export"><button type="button" onClick={download} disabled={busy} aria-busy={busy}>
    {busy ? "Przygotowywanie PDF…" : "Pobierz raport KYS (PDF)"}</button>
    {busy && <p role="status">Przygotowywanie dokumentu z zapisanego raportu…</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
