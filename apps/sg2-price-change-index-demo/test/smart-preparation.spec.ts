import {test,expect} from '@playwright/test'
import {build} from 'vite'
let script=''
test.beforeAll(async()=>{
 const result=await build({configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},build:{write:false,minify:false,lib:{entry:'test/fixtures/smart-host.tsx',formats:['es'],name:'SmartAcceptance'},rollupOptions:{output:{inlineDynamicImports:true}}}})
 const bundle=Array.isArray(result)?result[0]:result
 if(!('output' in bundle))throw Error('Browser bundle required')
 script=bundle.output.filter(x=>x.type==='chunk').map(x=>'code' in x?x.code:'').join('\n')
})
for(const locale of ['pl','en'] as const)for(const width of [390,1440])for(const theme of ['Jasny','Ciemny']){
 test(`smart public module ${locale} ${width} ${theme}: explicit consent, separate proxy, recoverable refusal`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/v3');await page.setContent('<!doctype html><html><body style="margin:0"><div id="root"></div></body></html>');await page.route('**/__smart-fixture.js',route=>route.fulfill({contentType:'text/javascript',body:script}));await page.addScriptTag({type:'module',url:'/__smart-fixture.js'})
  const ui=page.locator('[data-pci-mode=business]')
  if(locale==='en')await page.getByRole('button',{name:'PL/EN',exact:true}).click()
  await ui.getByRole('button',{name:theme,exact:true}).click()
  const action=ui.getByRole('button',{name:locale==='pl'?'Przeanalizuj cenę':'Analyse price',exact:true})
  await expect(action).toBeDisabled();await ui.getByRole('checkbox',{name:locale==='pl'?/Potwierdzam użycie/:/I confirm the stated/}).check();await expect(action).toBeEnabled()
  await action.click();await expect(ui.getByRole('heading',{name:locale==='pl'?'Ścisłe odniesienie — modelowana cena zakupu':'Strict reference — modeled purchase price'})).toBeVisible()
  await page.getByRole('button',{name:'proxy',exact:true}).click()
  const proxy=ui.getByRole('button',{name:locale==='pl'?'Zatwierdź wcześniejszy okres i pokaż indeks rynku':'Confirm earlier reference and show market index',exact:true})
  await expect(proxy).toBeDisabled();await ui.getByRole('checkbox',{name:locale==='pl'?/Akceptuję wcześniejsze odniesienie/:/I accept this earlier reference/}).check();await proxy.click()
  await expect(ui.getByRole('heading',{name:locale==='pl'?'Wcześniejsze proxy — wyłącznie indeks rynku':'Earlier proxy — market index only'})).toBeVisible();await expect(ui.locator('.pci-market-result .v3-price')).toHaveText('10%')
  await expect(ui.locator('.pci-market-result .v3-component-line')).toHaveCount(5)
  await page.getByRole('button',{name:'refusal',exact:true}).click();await expect(action).toBeDisabled();await expect(ui.getByRole('heading',{name:locale==='pl'?'Brak wiarygodnego wspólnego okresu':'No reliable common period'})).toBeVisible()
  await expect(ui.getByLabel(locale==='pl'?'Data zakupu':'Purchase date',{exact:true})).toHaveValue('2026-10-22')
  const geometry=await ui.locator('footer').evaluate(el=>el.getBoundingClientRect().bottom);expect(geometry).toBeLessThanOrEqual(901)
 })
}
