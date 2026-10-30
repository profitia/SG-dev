/** Loopback-only acceptance: real Finder/Picker/PCI, synthetic external metadata,
 * session and history. Never represents live Clerk/Macrobond acceptance. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {classifyBenchmark} from '../lib/benchmark/qualification.ts'
const require=createRequire(new URL('../../sg2-price-change-index-demo/package.json',import.meta.url)),{chromium}=require('playwright')
const base=process.env.JOURNEY_PREVIEW_URL||'http://127.0.0.1:33577',output=process.env.JOURNEY_BROWSER_OUTPUT
if(new URL(base).hostname!=='127.0.0.1'||!output||!path.isAbsolute(output))throw Error('Explicit loopback preview and absolute output required')
fs.mkdirSync(output,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.JOURNEY_BROWSER_CHANNEL?{channel:process.env.JOURNEY_BROWSER_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],calls=[]
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push({path:new URL(r.url()).pathname,method:r.method()})})
const metadata=c=>c.displayName==='Steel'?{...c,description:'Physical steel inventories',unit:'tonnes',currency:null}
 :c.displayName==='Energy'?{...c,description:'Energy producer price index',unit:'Index points',currency:null}
 :{...c,description:c.displayName+' spot price',unit:'USD/tonne',currency:'USD'}
try{
 await page.route('**/api/benchmark/search?**',async route=>{const response=await route.fetch(),body=await response.json();await route.fulfill({response,json:{...body,items:body.items.map(metadata)}})})
 await page.route('**/api/benchmark/selection',async route=>{const response=await route.fetch(),body=await response.json();const qualify=b=>({...b,semanticProfile:classifyBenchmark(metadata(b))});await route.fulfill({response,json:body.items?{...body,items:body.items.map(qualify)}:qualify(body)})})
 await page.request.post(base+'/__acceptance/reset');await page.goto(base+'/pl/dashboard')
 await page.getByRole('button',{name:'Uruchom Benchmark Finder',exact:true}).click()
 await page.getByRole('button',{name:'Schowaj asystenta',exact:true}).click()
 await page.getByPlaceholder('Szukaj benchmarku, surowca, indeksu lub rynku...').fill('Copper');await page.getByRole('button',{name:'Szukaj',exact:true}).click()
 const card=page.locator('[data-testid=benchmark-result-card]').first();await card.locator('[data-semantic-class=PRICE_LEVEL]').waitFor()
 assert.match(await card.innerText(),/PCI: odpowiedni semantycznie/)
 await card.locator('.bf-expand-control').click();await page.getByRole('button',{name:'Rozpocznij budowę kategorii',exact:false}).click()
 const ui=page.locator('.pci-host-dialog').locator('[data-pci-mode=business]')
 await ui.getByLabel('Nazwa kategorii').fill('BQL category');await ui.getByLabel('Nazwa komponentu 1',{exact:true}).fill('Copper');await ui.getByRole('spinbutton').first().fill('60')
 await ui.getByRole('button',{name:'+ Dodaj komponent',exact:true}).click()
 const picker=page.getByRole('dialog',{name:'Wybierz benchmark komponentu',exact:true})
 await picker.getByRole('searchbox').fill('Steel');await picker.getByRole('button',{name:'Szukaj',exact:true}).click()
 await picker.locator('[data-semantic-class=QUANTITY]').waitFor();assert.match(await picker.innerText(),/PCI: nieodpowiedni semantycznie/)
 await picker.getByRole('button',{name:'Wybierz benchmark: Steel',exact:true}).click();await picker.waitFor({state:'hidden'})
 await ui.getByLabel('Nazwa komponentu 2',{exact:true}).fill('Steel');await ui.getByRole('spinbutton').nth(1).fill('40')
 assert.equal(await ui.locator('tr[data-component-id]').count(),2);assert.match(await ui.getByRole('alert').innerText(),/nie cenę/)
 assert(await ui.getByRole('button',{name:'Dalej →',exact:true}).isDisabled())
 assert.equal(calls.filter(c=>c.path==='/api/cost-analysis/price-change-index').length,0,'no preparation for known incompatible quantity')
 await ui.getByRole('button',{name:'Zmień benchmark komponentu 2: Steel',exact:true}).click()
 await picker.getByRole('searchbox').fill('Energy');await picker.getByRole('button',{name:'Szukaj',exact:true}).click()
 await picker.locator('[data-semantic-class=PRICE_INDEX]').waitFor();await picker.getByRole('button',{name:'Wybierz benchmark: Energy',exact:true}).click();await picker.waitFor({state:'hidden'})
 assert.deepEqual(await ui.getByRole('textbox',{name:/^Nazwa komponentu /}).evaluateAll(els=>els.map(el=>el.value)),['Copper','Steel'])
 assert.deepEqual(await ui.getByRole('spinbutton').evaluateAll(els=>els.map(el=>el.value)),['60','40'])
 assert.equal(await ui.getByRole('alert').count(),0)
 const geometry=[]
 for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:640},{width:2560,height:1440}]){
  await page.setViewportSize(viewport)
  for(const theme of ['Ciemny','Jasny']){
   await ui.getByRole('button',{name:theme,exact:true}).click()
   const measure=await ui.locator('.pci-business').evaluate(el=>{const main=el.querySelector('main'),footer=el.querySelector('footer').getBoundingClientRect();return{height:main.clientHeight,scrollHeight:main.scrollHeight,width:main.clientWidth,scrollWidth:main.scrollWidth,bottom:footer.bottom}})
   assert.equal(measure.scrollHeight,measure.height);assert(measure.scrollWidth<=measure.width);assert(measure.bottom<=viewport.height)
   for(const row of await ui.locator('tr[data-component-id]').all()){await row.scrollIntoViewIfNeeded();assert(await row.isVisible())}
   geometry.push({viewport,theme,...measure});await page.screenshot({path:path.join(output,`bql-${viewport.width}-${theme}.png`)})
  }
 }
 await page.setViewportSize({width:1440,height:900});await ui.getByRole('button',{name:'Dalej →',exact:true}).click()
 for(const [label,value] of [['Ostatnia cena zakupu','100'],['Waluta zakupu','PLN'],['Jednostka zakupu','tona'],['Warunki dostawy','EXW']])await ui.getByLabel(label,{exact:true}).fill(value)
 await ui.getByLabel('Cena netto / brutto').selectOption('NET');await ui.getByRole('button',{name:'Dalej →',exact:true}).click()
 await ui.getByLabel('Data zakupu',{exact:true}).fill('2024-01-02');await ui.getByLabel('Data benchmarku do porównania',{exact:true}).fill('2024-01-02')
 await ui.getByLabel('Co oznaczają wartości benchmarków?').selectOption('POINT_IN_TIME')
 await ui.locator('.pci-series-declarations select').first().selectOption('PRICE_LEVEL')
 await ui.locator('.pci-series-declarations select').nth(1).selectOption('PRICE_LEVEL')
 await ui.getByRole('alert').filter({hasText:'Deklaracja rodzaju danych'}).waitFor()
 assert(await ui.getByRole('button',{name:'Przeanalizuj cenę',exact:true}).isDisabled())
 await ui.locator('.pci-series-declarations select').nth(1).selectOption('PRICE_INDEX')
 await ui.getByRole('checkbox',{name:/Potwierdzam porównanie/}).check()
 await ui.getByRole('button',{name:'Przeanalizuj cenę',exact:true}).click()
 await ui.locator('[data-flow-screen=result]').waitFor()
 assert.equal(await ui.getByRole('alert').count(),0)
 await ui.getByRole('button',{name:'Gotowe, wróć do Benchmark Findera',exact:true}).click()
 assert.equal(await page.locator('.pci-host-dialog').count(),0);assert.equal(await page.getByPlaceholder('Szukaj benchmarku, surowca, indeksu lub rynku...').inputValue(),'Copper')
 assert.deepEqual(errors,[])
 fs.writeFileSync(path.join(output,'bql-browser-result.json'),JSON.stringify({status:'PASS',externalAuthority:'SYNTHETIC_LOOPBACK_ONLY',actualUiAndCore:true,geometry,calls,errors},null,2))
}finally{await browser.close()}
