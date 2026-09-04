import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

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

test('benchmark finder starts from Search while preserving the outer PORR frame', () => {
  assert.match(benchmarkFinderClientSource, /<h1 className="text-base font-semibold text-slate-950">\{t\('mode\.search'\)\}<\/h1>/)
  assert.match(shellSource, /rounded-\[32px\] border border-slate-200 bg-white\/90/)
  assert.doesNotMatch(shellSource, /<header className=/)
  assert.doesNotMatch(shellSource, /getTranslations|openFinder|Overview|Przegląd/)
})

test('login planned topics render exactly one bullet', () => {
  const plannedTopicOccurrences = [...homePageSource.matchAll(/plannedTopicsItem[A-Z][A-Za-z]+/g)].length

  assert.equal(plannedTopicOccurrences, 1)
  assert.match(homePageSource, /<li>\{t\('porrDemo\.plannedTopicsItemOne'\)\}<\/li>/)
})

test('login messages keep only the requested next-version copy', () => {
  const porrDemoPl = readPorrDemoMessages(polishMessages)
  const porrDemoEn = readPorrDemoMessages(englishMessages)

  assert.equal(porrDemoPl.plannedTopicsItemOne, 'Optymalizacja procesu tworzenia prognozy.')
  assert.equal(porrDemoEn.plannedTopicsItemOne, 'Forecast generation process optimization.')
  assert.equal('plannedTopicsItemTwo' in porrDemoPl, false)
  assert.equal('plannedTopicsItemThree' in porrDemoPl, false)
  assert.equal('plannedTopicsItemTwo' in porrDemoEn, false)
  assert.equal('plannedTopicsItemThree' in porrDemoEn, false)
})
