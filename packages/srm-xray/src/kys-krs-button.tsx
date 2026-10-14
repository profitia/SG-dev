"use client";
import React, { useEffect, useRef, useState } from "react";
import { CanonButton } from "./ui-canon";
import { KysIcon } from "./kys-report";
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
  return <div className="kys-pdf-export"><CanonButton canonId="SRM-C02" usage="kys-krs-button.tsx:download" type="button" onClick={download} disabled={busy} aria-busy={busy}>
    <KysIcon kind="download" />{busy ? "Pobieranie KRS…" : "Pobierz aktualny KRS"}</CanonButton>
    {error && <p role="alert">{error}</p>}
  </div>;
}
