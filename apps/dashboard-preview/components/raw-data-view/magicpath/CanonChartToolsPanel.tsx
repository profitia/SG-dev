import React from 'react';
import { CanonButton, CanonElement } from './CanonElements';
import { CanonChartControlGlyph } from './CanonChartControlGlyph';
import { useChartPanel } from './useChartPanel';
import { chartControlPanelVariables } from './chart-control-panel-contract';


/** C84 empty analytical workspace; C85 edge ribbon. No pin control. */
export function CanonChartToolsPanel({
  onOpenChange
}: {
  onOpenChange?: (open: boolean) => void;
}) {
  const {
    open,
    root,
    panel,
    trigger,
    id,
    toggle
  } = useChartPanel(onOpenChange);
  return <div ref={root} className="srm-chart-tools" style={chartControlPanelVariables as React.CSSProperties} data-open={open}>
    <div ref={panel} id={id} className="srm-chart-tools-clip" aria-hidden={!open || undefined}>
      <CanonElement as="section" canonId="SRM-C84" usage="CanonChartToolsPanel:panel" className="srm-chart-tools-card" aria-label="Narzędzia wykresu">
        <div className="srm-chart-tools-content" />
      </CanonElement>
    </div>
    <CanonButton canonId="SRM-C85" usage="CanonChartToolsPanel:ribbon" ref={trigger} type="button" className="srm-chart-controls-ribbon srm-chart-tools-ribbon" aria-expanded={open} aria-controls={id} aria-label={open ? 'Schowaj panel narzędzi wykresu' : 'Rozwiń panel narzędzi wykresu'} title={open ? 'Schowaj narzędzia wykresu' : 'Narzędzia wykresu'} onClick={toggle}>
      <span className="srm-chart-controls-symbol"><CanonChartControlGlyph kind="toolbox" size={18} /></span>
    </CanonButton>
  </div>;
}
