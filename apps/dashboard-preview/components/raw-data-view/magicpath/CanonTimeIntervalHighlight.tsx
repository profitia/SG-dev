import React, { useId } from 'react';
import { CanonElement } from './CanonElements';
export type TimeIntervalFocus = {
  lower: number;
  upper: number;
  marker: number | null;
};
/** SRM-C79 · CHT-07 · B56. Only time position, never selection or data interpolation. */
export function CanonTimeIntervalHighlight({
  count,
  positionAt,
  focus
}: {
  count: number;
  positionAt: (index: number) => number;
  focus: TimeIntervalFocus | null;
}) {
  const id = useId().replace(/:/g, '') + '-time-band';
  return <CanonElement as="g" canonId="SRM-C79" usage="CanonTimeIntervalHighlight:plot" className="srm-time-interval-bands" data-near-marker={focus?.marker != null} aria-hidden="true" pointerEvents="none">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="var(--brand-light)" stopOpacity="0.02" />
      <stop offset="65%" stopColor="var(--brand-light)" stopOpacity="0.09" />
      <stop offset="100%" stopColor="var(--brand-light)" stopOpacity="0.16" />
    </linearGradient></defs>
    {Array.from({
      length: Math.max(0, count - 1)
    }, (_, lower) => {
      const left = Math.max(24, positionAt(lower));
      const right = Math.min(788, positionAt(lower + 1));
      if (right <= left) return null;
      const active = focus?.lower === lower;
      return <g key={lower} className="srm-time-interval-band" data-highlighted={active} data-interval-start={lower} data-interval-end={lower + 1}>
        <rect x={left} y="0" width={right - left} height="316" fill={'url(#' + id + ')'} />
      </g>;
    })}
  </CanonElement>;
}
