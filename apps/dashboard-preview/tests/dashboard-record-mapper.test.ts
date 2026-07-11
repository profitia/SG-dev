import test from 'node:test'
import assert from 'node:assert/strict'

import { toBusinessSafeDashboardRecord } from '@/lib/raw-data/dashboard-record-mapper'

const baseRecord = {
  id: 'rec-1',
  organizationId: 'org-1',
  sourceId: 'market-indexes',
  datasetId: 'index-data',
  pipelineId: 'dashboard',
  latestRunId: 'run-1',
  dedupeKey: 'key-1',
  scenarioType: '',
  componentId: 'component-1',
  componentName: '',
  componentCode: null,
  metricValue: null,
  unit: null,
  currency: null,
  sourceDate: '2026-07-01T00:00:00.000Z',
  market: null,
  country: null,
  qualityStatus: null,
  duplicateStatus: null,
  rawRecordCount: 1,
  duplicateCount: 0,
  lineageJson: null,
  metadataJson: {
    fields: {
      valueType: 'forecast',
      indeks: 'VESPER-ABC',
      value: 125.5,
      nazwaSkAdnika: 'energia elektryczna',
      lciValue: 110,
      uciValue: 140,
      diff: 0.1,
      descriptionPl: 'Opis PL',
      descriptionEng: 'Description EN',
    },
  },
  lastSyncedAt: '2026-07-09T00:00:00.000Z',
} as const

test('dashboard mapper uses fallback fields for business-safe payload', () => {
  const mapped = toBusinessSafeDashboardRecord(baseRecord, { locale: 'pl' })

  assert.equal(mapped.scenarioType, 'forecast')
  assert.equal(mapped.componentCode, 'VESPER-ABC')
  assert.equal(mapped.metricValue, 125.5)
  assert.equal(mapped.componentName, 'energia elektryczna')
  assert.equal(mapped.lciValue, 110)
  assert.equal(mapped.uciValue, 140)
  assert.equal(mapped.diff, 0.1)
  assert.equal(mapped.descriptionPl, 'Opis PL')
  assert.equal(mapped.descriptionEn, 'Description EN')
})

test('dashboard mapper parses tuple carriers when business fields are serialized into strings', () => {
  const mapped = toBusinessSafeDashboardRecord(
    {
      ...baseRecord,
      scenarioType: 'UNCLASSIFIED',
      componentId:
        '[["% DIFF",-0.5081],["DATE","2027-06-01T00:00:00.000Z"],["DESCRIPTION_ENG","Destatis, Lime Index in Germany adjusted with Polish PPI in sector"],["DESCRIPTION_PL","Destatis, Index wapna w Niemczech po korekcie o polski PPI w sektorze"],["Indeks","WAPNO"],["LCI_VALUE",135.821177964],["Nazwa składnika","WAPNO"],["UCI_VALUE",224.461099874],["VALUE",180.141138919],["VALUE_TYPE","Forecast"]]',
      componentName: 'record-2619',
      componentCode: null,
      metricValue: null,
      sourceDate: null,
      metadataJson: {
        normalizedFieldNames: ['date', 'descriptionEng', 'descriptionPl', 'diff', 'indeks', 'lciValue', 'nazwaSkAdnika', 'uciValue', 'value', 'valueType'],
      },
      lineageJson: {
        duplicateKey:
          '[["% DIFF",-0.5081],["DATE","2027-06-01T00:00:00.000Z"],["DESCRIPTION_ENG","Destatis, Lime Index in Germany adjusted with Polish PPI in sector"],["DESCRIPTION_PL","Destatis, Index wapna w Niemczech po korekcie o polski PPI w sektorze"],["Indeks","WAPNO"],["LCI_VALUE",135.821177964],["Nazwa składnika","WAPNO"],["UCI_VALUE",224.461099874],["VALUE",180.141138919],["VALUE_TYPE","Forecast"]]',
      },
    },
    { locale: 'pl' },
  )

  assert.equal(mapped.scenarioType, 'Forecast')
  assert.equal(mapped.componentName, 'WAPNO')
  assert.equal(mapped.componentCode, 'WAPNO')
  assert.equal(mapped.metricValue, 180.141138919)
  assert.equal(mapped.sourceDate, '2027-06-01T00:00:00.000Z')
  assert.equal(mapped.lciValue, 135.821177964)
  assert.equal(mapped.uciValue, 224.461099874)
  assert.equal(mapped.diff, -0.5081)
  assert.equal(mapped.descriptionPl, 'Destatis, Index wapna w Niemczech po korekcie o polski PPI w sektorze')
  assert.equal(mapped.descriptionEn, 'Destatis, Lime Index in Germany adjusted with Polish PPI in sector')
  assert.equal(mapped.topLevelTrustFlags.scenarioTypeFromFallback, true)
  assert.equal(mapped.topLevelTrustFlags.componentNameFromFallback, true)
  assert.equal(mapped.topLevelTrustFlags.componentCodeFromFallback, true)
  assert.equal(mapped.topLevelTrustFlags.metricValueFromFallback, true)
})
