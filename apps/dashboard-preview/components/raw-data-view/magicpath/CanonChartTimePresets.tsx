import React from 'react';
import { useLocale } from 'next-intl';
import { CanonButton, CanonElement } from './CanonElements';
import { chartTimePresets, chartTimePresetVariables, type ChartTimePreset } from './chart-time-presets';

const englishRangeLabels: Record<ChartTimePreset, string> = {
  '1M': 'Last month',
  '3M': 'Last 3 months',
  '6M': 'Last 6 months',
  '1Y': 'Last year',
  '3Y': 'Last 3 years',
  '5Y': 'Last 5 years',
  All: 'All available history'
};

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
  const polish = useLocale() === 'pl';

  return <CanonElement as="div" canonId="SRM-C86" usage="CanonChartTimePresets:rail" className="srm-chart-time-presets" role="group" aria-label={polish ? 'Zakres czasu wykresu' : 'Chart time range'} style={chartTimePresetVariables as React.CSSProperties}>
    {chartTimePresets.map(preset => {
      const label = polish ? preset.label : englishRangeLabels[preset.id];
      return <CanonButton key={preset.id} type="button" canonId="SRM-C86" usage={'CanonChartTimePresets:' + preset.id} className="srm-chart-time-preset" aria-pressed={value === preset.id} aria-label={label} aria-controls={controls} title={label} disabled={disabled} onClick={() => onChange(preset.id)}>
        {polish && preset.id === 'All' ? 'Cała' : preset.id}
      </CanonButton>;
    })}
  </CanonElement>;
}
