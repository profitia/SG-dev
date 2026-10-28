// Product controls vendored from MagicPath 463321469305384960@465857540723474432.
// Instruction wrappers removed; source IDs retained. No demo runtime or observations.
import React from 'react';
import { CanonButton, CanonElement } from './CanonElements';
import { chartTimePresets, chartTimePresetVariables, type ChartTimePreset } from './chart-time-presets';
export function CanonChartTimePresets({ value, onChange, controls, disabled = false }: {
    value: ChartTimePreset | null;
    onChange: (value: ChartTimePreset) => void;
    controls: string;
    disabled?: boolean;
}) {
    return <CanonElement {...{ "data-design-source": "460628347660177408:7cd89d5ecfd959", "data-source-export-revision": "465857540723474432" }} as="div" canonId="SRM-C86" usage="CanonChartTimePresets:rail" className="srm-chart-time-presets" role="group" aria-label="Zakres czasu wykresu" style={chartTimePresetVariables as React.CSSProperties}>
    {chartTimePresets.map(preset => <CanonButton {...{ "data-design-source": "460628347660177408:d321235fe1e182", "data-source-export-revision": "465857540723474432" }} key={preset.id} type="button" canonId="SRM-C86" usage={'CanonChartTimePresets:' + preset.id} className="srm-chart-time-preset" aria-pressed={value === preset.id} aria-label={'Zakres ' + preset.id} aria-controls={controls} title={preset.label} disabled={disabled} onClick={() => onChange(preset.id)}>
      <>{preset.id}</>
    </CanonButton>)}
  </CanonElement>;
}
