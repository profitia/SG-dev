import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { PORR_DEMO_FORECAST_BENCHMARKS } from '@/lib/benchmark/porr-demo-forecast-portfolio'

const benchmarkFinderClientSource = fs.readFileSync(new URL('../components/benchmark-finder/benchmark-finder-client.tsx', import.meta.url), 'utf8')
const shellSource = fs.readFileSync(new URL('../components/porr-demo/porr-demo-shell.tsx', import.meta.url), 'utf8')
const homePageSource = fs.readFileSync(new URL('../app/[locale]/page.tsx', import.meta.url), 'utf8')
const polishMessages = JSON.parse(fs.readFileSync(new URL('../messages/pl.json', import.meta.url), 'utf8')) as Record<string, unknown>
const englishMessages = JSON.parse(fs.readFileSync(new URL('../messages/en.json', import.meta.url), 'utf8')) as Record<string, unknown>

function readPorrDemoMessages(dictionary: Record<string, unknown>) {
  const homePage = dictionary.HomePage
  if (!homePage || typeof homePage !== 'object') {
    throw new Error('HomePage messages missing')
  }

  const porrDemo = (homePage as Record<string, unknown>).porrDemo
  if (!porrDemo || typeof porrDemo !== 'object') {
    throw new Error('PORR demo messages missing')
  }

  return porrDemo as Record<string, unknown>
}

function readBenchmarkFinderMessages(dictionary: Record<string, unknown>) {
  const messages = dictionary.BenchmarkFinder
  if (!messages || typeof messages !== 'object') {
    throw new Error('BenchmarkFinder messages missing')
  }
  return messages as Record<string, unknown>
}

test('benchmark finder starts from Search while preserving the outer PORR frame', () => {
  assert.match(benchmarkFinderClientSource, /<h1 className="text-base font-semibold text-slate-950">\{t\('mode\.search'\)\}<\/h1>/)
  assert.match(benchmarkFinderClientSource, /disabled\s+aria-disabled="true"\s+data-testid="benchmark-mode-ai"/)
  assert.match(benchmarkFinderClientSource, /t\('mode\.comingSoon'\)/)
  assert.match(shellSource, /rounded-\[32px\] border border-slate-200 bg-white\/90/)
  assert.doesNotMatch(shellSource, /<header className=/)
  assert.doesNotMatch(shellSource, /getTranslations|openFinder|Overview|Przegląd/)
})

test('login messages publish version 1.2 with three next-version topics', () => {
  const porrDemoPl = readPorrDemoMessages(polishMessages)
  const porrDemoEn = readPorrDemoMessages(englishMessages)

  assert.equal(porrDemoPl.versionLabel, 'Wersja: 1.2')
  assert.equal(porrDemoEn.versionLabel, 'Version: 1.2')
  assert.equal(porrDemoPl.publicationDateLabel, 'Data publikacji: 2026.09.17')
  assert.equal(porrDemoEn.publicationDateLabel, 'Publication date: 2026-09-17')
  assert.ok(porrDemoPl.plannedTopicsItemOne)
  assert.ok(porrDemoPl.plannedTopicsItemTwo)
  assert.ok(porrDemoPl.plannedTopicsItemThree)
  assert.ok(porrDemoEn.plannedTopicsItemOne)
  assert.ok(porrDemoEn.plannedTopicsItemTwo)
  assert.ok(porrDemoEn.plannedTopicsItemThree)
})

test('login reuses the canonical eleven-benchmark portfolio and exposes version history', () => {
  assert.match(homePageSource, /PORR_DEMO_FORECAST_BENCHMARKS\.filter/)
  assert.match(homePageSource, /<details className=/)
  assert.match(homePageSource, /versionHistoryChangelogLabel/)
  assert.equal(PORR_DEMO_FORECAST_BENCHMARKS.length, 11)
})

test('PORR demo exposes one bilingual, operator-approved eleven-benchmark portfolio', () => {
  const polish = readBenchmarkFinderMessages(polishMessages)
  const english = readBenchmarkFinderMessages(englishMessages)
  const polishPortfolio = polish.portfolio as Record<string, unknown>
  const englishPortfolio = english.portfolio as Record<string, unknown>

  assert.equal(PORR_DEMO_FORECAST_BENCHMARKS.length, 11)
  assert.equal(new Set(PORR_DEMO_FORECAST_BENCHMARKS.map((item) => item.seriesId)).size, 11)
  assert.match(benchmarkFinderClientSource, /data-testid="porr-demo-forecast-portfolio"/)
  assert.match(benchmarkFinderClientSource, /openPorrDemoPortfolioBenchmark/)
  assert.match(String(polishPortfolio.subtitle), /przygotować prognozę/)
  assert.match(String(englishPortfolio.subtitle), /prepare a forecast/)
  assert.doesNotMatch(benchmarkFinderClientSource, /portfolio\.historyOnlyMessage/)
  assert.equal('historyOnlyMessage' in polishPortfolio, false)
  assert.equal('historyOnlyMessage' in englishPortfolio, false)
})
