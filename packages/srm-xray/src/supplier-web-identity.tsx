"use client";
import React, { useEffect, useState, type ReactNode } from "react";
import type { SupplierWebIdentityData } from "./contracts";

export type SupplierWebIdentityGateway = (signal: AbortSignal) => Promise<SupplierWebIdentityData>;
/** The host owns transport/authentication; the reusable component sees a normalized DTO only. */
export function SupplierWebIdentity({ name, load, children }: {
  name: string; load: SupplierWebIdentityGateway; children: ReactNode;
}) {
  const [data, setData] = useState<SupplierWebIdentityData | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    setData(null); setImageFailed(false);
    async function run(attempt = 0) {
      try {
        const next = await load(controller.signal);
        if (controller.signal.aborted) return;
        setData(next.status === "PENDING" && attempt >= 24 ? { ...next, status: "UNAVAILABLE" } : next);
        if (next.status === "PENDING" && attempt < 24) timer = setTimeout(() => void run(attempt + 1), 2000);
      } catch {
        if (!controller.signal.aborted) setData({ status: "UNAVAILABLE", websiteUrl: null, logoDataUrl: null,
          logoSourceUrl: null, evidenceUrl: null, method: null, checkedAt: null });
      }
    }
    void run();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load]);
  const website = data?.status === "FOUND" && /^https?:\/\//.test(data.websiteUrl ?? "") ? data.websiteUrl : null;
  const logo = !imageFailed && data?.logoDataUrl?.startsWith("data:image/png;base64,") ? data.logoDataUrl : null;
  return <div className="supplier-web-identity">
    <div className="supplier-web-logo">
      {logo ? <img src={logo} alt={`Logo: ${name}`} width={80} height={64} onError={() => setImageFailed(true)} />
        : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M4 21V5l8-3v19M12 8h8v13M2 21h20M7 7h2M7 11h2M7 15h2M15 11h2M15 15h2M15 19h2"/></svg>}
    </div>
    <div className="supplier-web-details">{children}
      <div className="supplier-web-address" aria-live="polite">
        {website ? <a href={website} target="_blank" rel="noopener noreferrer"
          title="Otwórz stronę dostawcy w nowej karcie">{new URL(website).hostname.replace(/^www\./, "")}<span aria-hidden="true"> ↗</span></a>
          : <span>{!data || data.status === "PENDING" ? "Sprawdzanie strony WWW…" : "Nie potwierdzono strony WWW"}</span>}
      </div>
    </div>
  </div>;
}
