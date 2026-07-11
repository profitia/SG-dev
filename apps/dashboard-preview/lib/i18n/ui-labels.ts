export const scenarioLabels = {
  pl: {
    historical: 'Historyczne',
    forecast: 'Prognoza',
    unclassified: 'Nieokreslone',
  },
  en: {
    historical: 'Historical',
    forecast: 'Forecast',
    unclassified: 'Unclassified',
  },
} as const

export function toScenarioLabel(locale: 'pl' | 'en', scenarioType: string | null | undefined) {
  const normalized = scenarioType?.trim().toLowerCase()

  if (normalized === 'historical') {
    return scenarioLabels[locale].historical
  }

  if (normalized === 'forecast') {
    return scenarioLabels[locale].forecast
  }

  return scenarioLabels[locale].unclassified
}
