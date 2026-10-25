import React from 'react';
import { CanonButton, CanonElement } from './CanonElements';
import { chartTimePresets, chartTimePresetVariables, type ChartTimePreset } from './chart-time-presets';

export function CanonChartTimePresets({
  value,
  onChange,
  controls,
  disabled = false
}: {
  value: ChartTimePreset | null;
  onChange: (value: ChartTimePreset) => void;
  controls: string;
  disabled?: boolean;
}) {
  return <CanonElement as="div" canonId="SRM-C86" usage="CanonChartTimePresets:rail" className="srm-chart-time-presets" role="group" aria-label="Zakres czasu wykresu" style={chartTimePresetVariables as React.CSSProperties}>
    {chartTimePresets.map(preset => <CanonButton key={preset.id} type="button" canonId="SRM-C86" usage={'CanonChartTimePresets:' + preset.id} className="srm-chart-time-preset" aria-pressed={value === preset.id} aria-label={'Zakres ' + preset.id} aria-controls={controls} title={preset.label} disabled={disabled} onClick={() => onChange(preset.id)}>
      {preset.id}
    </CanonButton>)}
  </CanonElement>;
}
