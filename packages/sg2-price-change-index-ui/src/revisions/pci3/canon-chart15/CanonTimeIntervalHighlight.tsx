// Product controls vendored from MagicPath 463321469305384960@465857540723474432.
// Instruction wrappers removed; source IDs retained. No demo runtime or observations.
import React, { useId } from 'react';
import { CanonElement } from './CanonElements';
export type TimeIntervalFocus = {
    lower: number;
    upper: number;
    marker: number | null;
};
/** SRM-C79 · CHT-07 · B56. Only time position, never selection or data interpolation. */
export function CanonTimeIntervalHighlight({ count, positionAt, focus }: {
    count: number;
    positionAt: (index: number) => number;
    focus: TimeIntervalFocus | null;
}) {
    const id = useId().replace(/:/g, '') + '-time-band';
    return <CanonElement {...{ "data-design-source": "460628347660177408:bbbc9e41678b8f", "data-source-export-revision": "465857540723474432" }} as="g" canonId="SRM-C79" usage="CanonTimeIntervalHighlight:plot" className="srm-time-interval-bands" data-near-marker={focus?.marker != null} aria-hidden="true" pointerEvents="none">
    <defs {...{ "data-design-source": "460628347660177408:f06b091474b824", "data-source-export-revision": "465857540723474432" }}><linearGradient {...{ "data-design-source": "460628347660177408:ff4c0354d77a53", "data-source-export-revision": "465857540723474432" }} id={id} x1="0" y1="0" x2="0" y2="1">
      <stop {...{ "data-design-source": "460628347660177408:ad53520dba289f", "data-source-export-revision": "465857540723474432" }} offset="0%" stopColor="var(--brand-light)" stopOpacity="0.02"/>
      <stop {...{ "data-design-source": "460628347660177408:d4c954743d6b95", "data-source-export-revision": "465857540723474432" }} offset="65%" stopColor="var(--brand-light)" stopOpacity="0.09"/>
      <stop {...{ "data-design-source": "460628347660177408:ff15cb0c2e1e7f", "data-source-export-revision": "465857540723474432" }} offset="100%" stopColor="var(--brand-light)" stopOpacity="0.16"/>
    </linearGradient></defs>
    {Array.from({
            length: Math.max(0, count - 1)
        }, (_, lower) => {
            const left = Math.max(24, positionAt(lower));
            const right = Math.min(788, positionAt(lower + 1));
            if (right <= left)
                return null;
            const active = focus?.lower === lower;
            return <g {...{ "data-design-source": "460628347660177408:9df19c781f5aae", "data-source-export-revision": "465857540723474432" }} key={lower} className="srm-time-interval-band" data-highlighted={active} data-interval-start={lower} data-interval-end={lower + 1}>
        <rect {...{ "data-design-source": "460628347660177408:684501dcd1e6d2", "data-source-export-revision": "465857540723474432" }} x={left} y="0" width={right - left} height="316" fill={'url(#' + id + ')'}/>
      </g>;
        })}
  </CanonElement>;
}
