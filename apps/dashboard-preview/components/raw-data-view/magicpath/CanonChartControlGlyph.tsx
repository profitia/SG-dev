import React from 'react';
/** I25/I26. Shared glyphs for the control panel and the icon gallery. */
export function CanonChartControlGlyph({
  kind,
  size = 18,
  stroke = 1.6,
  pinned = false
}: {
  kind: 'settings-sliders' | 'pin' | 'toolbox';
  size?: number;
  stroke?: number;
  pinned?: boolean;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'settings-sliders' ? <>
      <path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10" />
      <circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="9" cy="18" r="2" />
    </> : kind === 'toolbox' ? <><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v3h4v-3" /></> : <g transform={pinned ? undefined : 'rotate(30 12 12)'}>
      <path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6Z" fill={pinned ? 'currentColor' : 'none'} fillOpacity={pinned ? '.15' : undefined} />
      <path d="M12 15v6" />
    </g>}
  </svg>;
}
