"use client";
import React, { useEffect, useRef, useState } from "react";
import type { KysPdfSelection } from "./kys-pdf-document";

/** KRS is an on-demand document of the selected KYS verification, not a new verification order. */
export function KysKrsButton({ selection, onDownload }: { selection: KysPdfSelection;
  onDownload: (selection: KysPdfSelection, signal: AbortSignal) => Promise<void> }) {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  async function download() {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setError(null);
    try { await onDownload(selection, controller.signal); }
    catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Nie udało się pobrać odpisu KRS."); }
    finally { if (!controller.signal.aborted) { active.current = null; setBusy(false); } }
  }
  return <div className="kys-pdf-export"><button type="button" onClick={download} disabled={busy} aria-busy={busy}>
    {busy ? "Pobieranie KRS…" : "Pobierz aktualny KRS"}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
