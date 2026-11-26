import React, { useSyncExternalStore } from 'react';
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

// The dashboard layout keeps the document language in sync for direct and embedded views.
function subscribeToDocumentLocale(onChange: () => void) {
  const { defaultView, documentElement } = document;
  if (!defaultView?.MutationObserver) return () => {};
  const observer = new defaultView.MutationObserver(onChange);
  observer.observe(documentElement, { attributes: true, attributeFilter: ['lang'] });
  return () => observer.disconnect();
}

function getDocumentLocale() {
  return document.documentElement.lang === 'en' ? 'en' : 'pl';
}

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
  const polish = useSyncExternalStore(subscribeToDocumentLocale, getDocumentLocale, () => 'pl') === 'pl';

  return <CanonElement as="div" canonId="SRM-C86" usage="CanonChartTimePresets:rail" className="srm-chart-time-presets" role="group" aria-label={polish ? 'Zakres czasu wykresu' : 'Chart time range'} style={chartTimePresetVariables as React.CSSProperties}>
    {chartTimePresets.map(preset => {
      const label = polish ? preset.label : englishRangeLabels[preset.id];
      const accessibleName = preset.id === 'All'
        ? label
        : polish ? `Zakres ${preset.id}` : `${preset.id} – ${label}`;
      return <CanonButton key={preset.id} type="button" canonId="SRM-C86" usage={'CanonChartTimePresets:' + preset.id} className="srm-chart-time-preset" aria-pressed={value === preset.id} aria-label={accessibleName} aria-controls={controls} title={label} disabled={disabled} onClick={() => onChange(preset.id)}>
        {polish && preset.id === 'All' ? 'Cała' : preset.id}
      </CanonButton>;
    })}
  </CanonElement>;
}
