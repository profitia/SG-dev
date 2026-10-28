import test, {before} from 'node:test'
import assert from 'node:assert/strict'
let nav: any
before(async () => {const {loadAdpModule} = await import('./adp-appshell-preview.mjs'); nav = await loadAdpModule('lib/appshell/adp-navigation.ts')})

test('all areas and form sections have fixed locale-aware internal routes and round-trip navigation', () => {
  for (const locale of ['pl', 'en']) for (const view of ['overview','data','cooperation','activities','documents','ratings','xray','newsfeed'])
    for (const section of ['company','registers','payments','activity','declarations']) for (const dataArea of ['adp','contacts','relations']) {
      const state = {view, section, dataArea}, route = nav.adpPath(locale, state)
      assert.equal(new URL(route, 'https://host.invalid').pathname, `/${locale}/dashboard/adp`)
      assert.deepEqual(nav.parseAdpNavigation(route.split('?')[1] || ''), state)
    }
})
test('unknown paths, identifiers and redirect query values cannot become navigation authority', () => {
  assert.equal(nav.dashboardPath('en'), '/en/dashboard')
  assert.equal(nav.isAdpPath('/pl/dashboard/adp/', 'pl'), true)
  for (const path of ['/pl/dashboard/adp/private', '/pl/dashboard', '/en/dashboard/adp', 'https://elsewhere.invalid/pl/dashboard/adp']) assert.equal(nav.isAdpPath(path, 'pl'), false)
  assert.deepEqual(nav.parseAdpNavigation('view=https://elsewhere.invalid&section=../../account&area=private&userId=other&next=https://elsewhere.invalid'), nav.DEFAULT_ADP_NAVIGATION)
  assert.equal(nav.adpPath('pl', {view:'javascript:alert(1)', section:'x', dataArea:'x'}), '/pl/dashboard/adp')
})
