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

test('benchmark finder keeps Search controls within the MagicPath presentation', () => {
  assert.match(benchmarkFinderClientSource, /<h2 className="bf-search-title text-base font-semibold text-slate-950">\{t\('mode\.search'\)\}<\/h2>/)
  assert.match(benchmarkFinderClientSource, /disabled\s+aria-disabled="true"\s+data-testid="benchmark-mode-ai"/)
  assert.match(benchmarkFinderClientSource, /t\('mode\.comingSoon'\)/)
  assert.match(shellSource, /rounded-\[32px\] border border-slate-200 bg-white\/90/)
  assert.doesNotMatch(shellSource, /<header className=/)
  assert.doesNotMatch(shellSource, /getTranslations|openFinder|Overview|Przegląd/)
})

test('login publishes version 1.2 with an explicit environment label and three next-version topics', () => {
  const porrDemoPl = readPorrDemoMessages(polishMessages)
  const porrDemoEn = readPorrDemoMessages(englishMessages)

  assert.equal(porrDemoPl.versionLabel, 'Wersja: 1.2')
  assert.equal(porrDemoEn.versionLabel, 'Version: 1.2')
  assert.match(homePageSource, /env === 'staging'/)
  assert.match(homePageSource, /\? 'Staging'/)
  assert.match(homePageSource, /env === 'production'/)
  assert.match(homePageSource, /\? 'Production'/)
  assert.match(homePageSource, /: 'Development'/)
  assert.match(homePageSource, /t\('porrDemo\.versionLabel'\)\}\s+\{environmentDisplayName\}/)
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


test('visual source acceptance preserves prior receipts and existing search/chart calls and events', async () => {
  const {createHash} = await import('node:crypto')
  const {execFileSync} = await import('node:child_process')
  const ts = await import('typescript')
  const receipt = JSON.parse(fs.readFileSync(new URL('../operation-integration.json', import.meta.url), 'utf8'))
  const accepted = receipt.benchmarkVisualSourceCompatibility
  assert.equal(accepted.taskId, 'SG2-BENCHMARK-VISUAL-DEVELOPMENT-20261025')
  const previousBytes = execFileSync('git', ['show', accepted.previousReceiptSourceSha + ':apps/sg-runtime/operation-integration.json'])
  assert.equal(createHash('sha256').update(previousBytes).digest('hex'), accepted.previousReceiptSha256)
  for (const [key, value] of Object.entries(JSON.parse(previousBytes.toString()))) assert.deepEqual(receipt[key], value, key)
  for (const [path, digest] of Object.entries(accepted.applicationSourceDigests))
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../' + path, import.meta.url))).digest('hex'), digest, path)
  function interactions(file: string, source: string) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const calls: string[] = [], events: string[] = []
    function visit(node: import('typescript').Node) {
      if (ts.isCallExpression(node)) calls.push(node.getText(tree))
      if (ts.isJsxAttribute(node) && /^on[A-Z]/.test(node.name.getText(tree))) events.push(node.getText(tree))
      ts.forEachChild(node, visit)
    }
    visit(tree)
    return {calls, events}
  }
  for (const path of ['apps/sg-runtime/components/benchmark-finder/benchmark-finder-client.tsx', 'apps/dashboard-preview/components/raw-data-view/index.tsx']) {
    const previous = execFileSync('git', ['show', accepted.previousReceiptSourceSha + ':' + path], {encoding: 'utf8'})
    const current = fs.readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')
    assert.deepEqual(interactions(path, current), interactions(path, previous), path)
  }
  for (const path of ['lib/benchmark', 'lib/platform', 'components/auth', 'app/api']) {
    const changed = execFileSync('git', ['diff', accepted.previousReceiptSourceSha, '--', 'apps/sg-runtime/' + path], {encoding: 'utf8'})
    assert.equal(changed, '', path)
  }
  assert.equal(accepted.runtimeAuthenticationChanged, false)
  assert.equal(accepted.searchMechanismChanged, false)
  assert.equal(accepted.productDeploymentPerformed, false)
})
