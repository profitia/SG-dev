/** Run against the isolated loopback preview only. External identity/provider
 * are synthetic; the actual AppShell/Finder/Picker/PCI and CCI path are exercised. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(new URL('../../sg2-price-change-index-demo/package.json',import.meta.url))
const {chromium}=require('playwright')
const output=process.env.JOURNEY_BROWSER_OUTPUT
if(!output||!path.isAbsolute(output))throw Error('Explicit absolute test output required')
fs.mkdirSync(output,{recursive:true})
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true})
const errors=[],requests=[]
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push({path:new URL(r.url()).pathname,method:r.method(),body:r.postData()})})
page.on('dialog',d=>d.accept())
try{
 await page.request.post('http://127.0.0.1:33577/__acceptance/reset')
 await page.goto('http://127.0.0.1:33577/pl/dashboard')
 await page.getByRole('button',{name:'Uruchom Benchmark Finder',exact:true}).click()
 await page.getByRole('button',{name:'Schowaj asystenta',exact:true}).click()
 await page.getByPlaceholder('Szukaj benchmarku, surowca, indeksu lub rynku...').fill('Copper')
 await page.getByRole('button',{name:'Szukaj',exact:true}).click()
 await page.getByText('Copper',{exact:true}).first().waitFor()
 await page.locator('.bf-expand-control').first().click()
 await page.getByRole('button',{name:'Rozpocznij budowę kategorii',exact:false}).click()
 await page.locator('.pci-host-dialog').waitFor()
 const layer=page.locator('.pci-host-dialog'),ui=layer.locator('[data-pci-mode=business]')
 await ui.getByLabel('Nazwa kategorii').fill('Kategoria testowa')
 await ui.getByRole('textbox',{name:'Komponent',exact:true}).fill('Miedź')
 const weight=ui.getByRole('spinbutton').first();await weight.focus();assert.equal(await weight.inputValue(),'');await weight.fill('60');assert.equal(await weight.inputValue(),'60')
 await ui.getByRole('button',{name:'+ Dodaj komponent',exact:true}).click()
 const picker=page.getByRole('dialog',{name:'Wybierz benchmark komponentu',exact:true})
 await picker.getByRole('searchbox').fill('Energy');await picker.getByRole('button',{name:'Szukaj',exact:true}).click()
 await picker.getByRole('button',{name:'Wybierz: Energy',exact:true}).click()
 await picker.waitFor({state:'hidden'})
 await ui.getByRole('textbox',{name:'Komponent',exact:true}).nth(1).fill('Energia')
 await ui.getByRole('spinbutton').nth(1).fill('40')
 const geometry=[]
 async function measure(step){for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:900},{width:2560,height:1440}]){
  await page.setViewportSize(viewport)
  for(const theme of ['Ciemny','Jasny']){await ui.getByRole('button',{name:theme,exact:true}).click();await page.waitForTimeout(250)
   const dimensions=await ui.locator('.pci-business').evaluate(el=>{const main=el.querySelector('main'),footer=el.querySelector('footer'),box=el.getBoundingClientRect(),m=main.getBoundingClientRect(),f=footer.getBoundingClientRect();const controls=[...main.querySelectorAll('input,select,button')].filter(x=>x.getClientRects().length);return{box:{top:box.top,bottom:box.bottom,width:box.width},height:main.clientHeight,scrollHeight:main.scrollHeight,width:main.clientWidth,scrollWidth:main.scrollWidth,footer:{top:f.top,bottom:f.bottom},clipped:controls.filter(x=>{const r=x.getBoundingClientRect();return r.top<m.top||r.bottom>m.bottom||r.left<m.left||r.right>m.right}).map(x=>x.getAttribute('aria-label')||x.textContent)}})
   geometry.push({step,viewport,theme,...dimensions});assert(dimensions.box.top>=0&&dimensions.box.bottom<=viewport.height);assert.equal(dimensions.scrollHeight,dimensions.height,JSON.stringify(geometry.at(-1)));assert(dimensions.scrollWidth<=dimensions.width);assert.deepEqual(dimensions.clipped,[],JSON.stringify(geometry.at(-1)))
   await page.screenshot({path:path.join(output,`step-${step}-${viewport.width}-${theme}.png`)})
  }
 }}
 await measure(1);await page.setViewportSize({width:1440,height:1000})
 await ui.getByRole('button',{name:'Dalej →',exact:true}).tap()
 await ui.getByLabel('Ostatnia cena zakupu').fill('1000,00');await ui.getByLabel('Waluta zakupu').fill('PLN');await ui.getByLabel('Jednostka zakupu').fill('tona');await ui.getByLabel('Cena netto / brutto').selectOption('NET');await ui.getByLabel('Warunki dostawy').fill('EXW')
 await measure(2);await page.setViewportSize({width:1440,height:1000})
 await ui.getByRole('button',{name:'Dalej →',exact:true}).click()
 await ui.getByLabel('Data zakupu',{exact:true}).fill('2024-01-02');await ui.getByLabel('Znaczenie obserwacji').selectOption('POINT_IN_TIME')
 for(const select of await ui.locator('.pci-series-declarations select').all())await select.selectOption('PRICE_INDEX')
 await measure(3);await page.setViewportSize({width:1440,height:1000})
 await ui.getByRole('button',{name:'Przeanalizuj cenę',exact:true}).dblclick()
 await ui.locator('[data-flow-screen=result]').waitFor();await ui.getByRole('heading',{name:'Które komponenty odpowiadają za zmianę?'}).waitFor()
 assert((await ui.locator('.v3-price').innerText()).includes('1080')||(await ui.locator('.v3-price').innerText()).replace(/\s/g,'').includes('1080'))
 const crosshair=ui.locator('.srm-chart-crosshair');await crosshair.hover({position:{x:120,y:120}});assert.equal(await crosshair.getAttribute('data-visible'),'true')
 await crosshair.focus();await page.keyboard.press('ArrowRight');assert.equal(await crosshair.getAttribute('data-visible'),'true');await page.screenshot({path:path.join(output,'chart-crosshair.png')});await page.keyboard.press('Escape');assert.equal(await crosshair.getAttribute('data-visible'),'false');assert(await layer.isVisible())
 const end=ui.getByRole('slider',{name:'Koniec zakresu czasu',exact:true});await end.focus();await page.keyboard.press('ArrowLeft');assert(Number(await end.getAttribute('aria-valuenow'))<2)
 await ui.getByRole('button',{name:'Zakres All',exact:true}).click();assert.equal(await end.getAttribute('aria-valuenow'),'2')
 for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:900},{width:2560,height:1440}]){await page.setViewportSize(viewport);for(const theme of ['Ciemny','Jasny']){await ui.getByRole('button',{name:theme,exact:true}).click();await page.waitForTimeout(250);const finalBox=await ui.getByRole('button',{name:'Gotowe, wróć do Benchmark Findera',exact:true}).boundingBox();assert(finalBox&&finalBox.y>=0&&finalBox.y+finalBox.height<=viewport.height);await page.screenshot({path:path.join(output,`result-${viewport.width}-${theme}.png`)})}}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(output,'result.png')})
 assert.equal(requests.filter(r=>r.path==='/api/cost-analysis/price-change-index').length,1)
 await ui.getByRole('button',{name:'Zapisz strukturę kategorii',exact:true}).dblclick();await ui.getByRole('button',{name:'Zapisano strukturę kategorii',exact:true}).waitFor()
 assert.equal(requests.filter(r=>r.path==='/api/category'&&r.method==='POST').length,1)
 await ui.getByRole('button',{name:'Gotowe, wróć do Benchmark Findera',exact:true}).click();await layer.waitFor({state:'hidden'})
 assert.equal(await page.getByPlaceholder('Szukaj benchmarku, surowca, indeksu lub rynku...').inputValue(),'Copper');assert.equal(await page.locator('.bf-expand-control').first().getAttribute('aria-expanded'),'true');assert(await page.getByRole('button',{name:'Rozpocznij budowę kategorii',exact:false}).evaluate(el=>el===document.activeElement));assert.equal(await page.locator('[data-existing-auth-flow]').count(),0)
 const selectionWrites=()=>requests.filter(r=>r.path==='/api/benchmark/selection'&&r.method==='POST').length
 assert.equal(selectionWrites(),2)
 await page.getByRole('button',{name:'Rozpocznij budowę kategorii',exact:false}).click();await layer.waitFor();await page.keyboard.press('Escape');await layer.waitFor({state:'hidden'});assert.equal(selectionWrites(),2)
 await page.getByRole('button',{name:'Rozpocznij budowę kategorii',exact:false}).click();await layer.waitFor();await ui.getByLabel('Nazwa kategorii').fill('PRIVATE TRANSIENT')
 await page.evaluate(()=>globalThis.__setJourneyAuth({orgId:'synthetic-org-b'}));await layer.waitFor({state:'hidden'});assert.equal(await page.locator('dialog[open]').count(),0)
 assert.equal(requests.filter(r=>r.path==='/api/category'&&r.method==='POST').length,1)
 await page.evaluate(()=>globalThis.__setJourneyAuth({isSignedIn:false}));assert.equal(await page.locator('dialog[open]').count(),0)
 fs.writeFileSync(path.join(output,'geometry.json'),JSON.stringify(geometry,null,2))
 console.log('Automated synthetic-provider journey and responsive checks PASS')
 assert.deepEqual(errors,[])
}finally{fs.writeFileSync(path.join(output,'browser-errors.json'),JSON.stringify({errors,requests},null,2));await browser.close()}
