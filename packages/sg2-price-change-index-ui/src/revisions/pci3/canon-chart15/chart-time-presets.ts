// Product controls vendored from MagicPath 463321469305384960@465857540723474432.
// Instruction wrappers removed; source IDs retained. No demo runtime or observations.
/** CHT-11 / C86 / B61: calendar lookback, separate from sample frequency. */
export const chartTimePresets = [
    { id: '1M', months: 1, label: 'Ostatni miesiąc' },
    { id: '3M', months: 3, label: 'Ostatnie 3 miesiące' },
    { id: '6M', months: 6, label: 'Ostatnie 6 miesięcy' },
    { id: '1Y', months: 12, label: 'Ostatni rok' },
    { id: '3Y', months: 36, label: 'Ostatnie 3 lata' },
    { id: '5Y', months: 60, label: 'Ostatnie 5 lat' },
    { id: 'All', months: null, label: 'Cała dostępna historia' }
] as const;
export type ChartTimePreset = typeof chartTimePresets[number]['id'];
export const chartTimePresetCanon = {
    width: '2.25rem', rowHeight: '2rem', gap: '.25rem', topGap: '.5rem',
    fontSize: '.8125rem', lineHeight: '1.5', normalWeight: 400, activeWeight: 700
} as const;
export const chartTimePresetVariables = {
    '--chart-presets-width': chartTimePresetCanon.width,
    '--chart-presets-row': chartTimePresetCanon.rowHeight,
    '--chart-presets-gap': chartTimePresetCanon.gap,
    '--chart-presets-top-gap': chartTimePresetCanon.topGap,
    '--chart-presets-font': chartTimePresetCanon.fontSize,
    '--chart-presets-line-height': chartTimePresetCanon.lineHeight,
    '--chart-presets-weight': chartTimePresetCanon.normalWeight,
    '--chart-presets-active-weight': chartTimePresetCanon.activeWeight
};
export function rangeForTimePreset(dates: readonly string[], preset: ChartTimePreset): [
    number,
    number
] {
    const end = dates.length - 1;
    const months = chartTimePresets.find(item => item.id === preset)?.months;
    if (end < 1 || months == null)
        return [0, Math.max(0, end)];
    const [year, month, day] = dates[end].split('-').map(Number);
    // Clamp the day before moving months: March 31 -> February 28/29, in UTC.
    const cutoff = new Date(Date.UTC(year, month - 1 - months, 1));
    const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
    cutoff.setUTCDate(Math.min(day, lastDay));
    const key = cutoff.toISOString().slice(0, 10);
    const first = dates.findIndex(date => date >= key);
    // The current navigator needs two observations. Never invent missing samples.
    return [Math.max(0, Math.min(first < 0 ? end - 1 : first, end - 1)), end];
}
