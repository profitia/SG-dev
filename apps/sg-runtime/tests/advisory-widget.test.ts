import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { runSpendGuruAdvisory } from '@/lib/advisory/cic-adapter'
import { SPENDGURU_WIDGET_COPY } from '@/lib/advisory/config'

test('maps a benchmark need through CIC to Benchmark Finder', () => {
  const result = runSpendGuruAdvisory({
    locale: 'pl',
    messages: [{ role: 'user', content: 'Potrzebuję benchmarku cenowego' }],
  })
  assert.equal(result.recommendation?.href, '/pl/benchmark-finder')
  assert.match(result.rationale?.summary ?? '', /Potrzebuję benchmarku/)
})

test('asks at most one focused question before deterministic routing', () => {
  const first = runSpendGuruAdvisory({ locale: 'en', messages: [{ role: 'user', content: 'Please help me.' }] })
  assert.equal(first.recommendation, null)
  assert.match(first.content, /Which outcome/)

  const second = runSpendGuruAdvisory({
    locale: 'en',
    messages: [
      { role: 'user', content: 'Please help me.' },
      { role: 'assistant', content: first.content },
      { role: 'user', content: 'I want to organise the category.' },
    ],
  })
  assert.equal(second.recommendation?.href, '/en/category-builder')
})

test('keeps copy bilingual and preserves four entry prompts', () => {
  assert.equal(SPENDGURU_WIDGET_COPY.pl.prompts.length, 4)
  assert.equal(SPENDGURU_WIDGET_COPY.en.prompts.length, 4)
})

test('keeps the widget out of the frozen PORR demo profile', () => {
  const layout = readFileSync(path.join(process.cwd(), 'app/[locale]/layout.tsx'), 'utf8')
  assert.match(layout, /enabled={!isPorrDemoProfile}/)
})
