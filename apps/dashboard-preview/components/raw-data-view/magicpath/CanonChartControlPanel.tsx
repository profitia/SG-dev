import React, { useLayoutEffect } from 'react';
import { useChartPanel } from './useChartPanel';
import { CanonButton, CanonElement } from './CanonElements';
import { CanonChartControlGlyph } from './CanonChartControlGlyph';
import { chartControlPanelVariables } from './chart-control-panel-contract';


/** C81 panel and C82 edge ribbon. Explicit toggling preserves chart options. */
export function CanonChartControlPanel({
  children,
  content,
  rows,
  onOpenChange,
  onHeightChange
}: {
  children: React.ReactNode;
  content?: React.ReactNode;
  rows?: [React.ReactNode, React.ReactNode];
  onOpenChange?: (open: boolean) => void;
  onHeightChange?: (height: number) => void;
}) {
  const {
    open,
    root,
    panel,
    trigger,
    id,
    toggle
  } = useChartPanel(onOpenChange);
  // Report the animated layout height, so the plot gives back exactly the same
  // space in each frame. No second animation or height-dependent resize loop.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !onHeightChange) return;
    const report = () => onHeightChange(element.getBoundingClientRect().height);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange]);
  return <div ref={root} className="srm-chart-controls" style={chartControlPanelVariables as React.CSSProperties} data-open={open}>
    <div className="srm-chart-controls-drawer">
      <div ref={panel} id={id} className="srm-chart-controls-clip" aria-hidden={!open || undefined}>
        <CanonElement as="section" canonId="SRM-C81" usage="CanonChartControlPanel:panel" className="srm-chart-controls-card" aria-label="Ustawienia wykresu">
          {content ?? <div className="srm-chart-controls-rows">
            <div className="srm-chart-controls-options" data-controls-row="1">{children}</div>
            <div className="srm-chart-controls-empty-row" data-controls-row="2" aria-hidden={rows ? undefined : true}>{rows?.[0]}</div>
            <div className="srm-chart-controls-empty-row" data-controls-row="3" aria-hidden={rows ? undefined : true}>{rows?.[1]}</div>
          </div>}
        </CanonElement>
      </div>
    </div>
    <CanonButton canonId="SRM-C82" usage="CanonChartControlPanel:ribbon" ref={trigger} type="button" className="srm-chart-controls-ribbon" aria-expanded={open} aria-controls={id} aria-label={open ? 'Schowaj panel sterowania wykresem' : 'Rozwiń panel sterowania wykresem'} title={open ? 'Schowaj ustawienia wykresu' : 'Ustawienia wykresu'} onClick={toggle}>
      <span className="srm-chart-controls-symbol"><CanonChartControlGlyph kind="settings-sliders" size={18} /></span>
    </CanonButton>
  </div>;
}
