/** Actual product UI/BFF/Core, synthetic external session/provider/persistence. Not live UAT. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(new URL('../../sg2-price-change-index-demo/package.json',import.meta.url)),{chromium}=require('playwright')
const base=process.env.JOURNEY_PREVIEW_URL||'http://127.0.0.1:33589',output=process.env.JOURNEY_BROWSER_OUTPUT
if(new URL(base).hostname!=='127.0.0.1'||!output||!path.isAbsolute(output))throw Error('Explicit loopback preview and absolute evidence output required')
fs.mkdirSync(output,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.JOURNEY_BROWSER_CHANNEL?{channel:process.env.JOURNEY_BROWSER_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],calls=[],checks=[]
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push({path:new URL(r.url()).pathname,method:r.method(),body:r.postData()})})
const ui=()=>page.locator('.pci-host-dialog [data-pci-mode=business]'),picker=()=>page.getByRole('dialog',{name:'Wybierz benchmark komponentu',exact:true})
async function add(title){await ui().getByRole('button',{name:'+ Dodaj komponent',exact:true}).click();await picker().getByRole('searchbox').fill(title);await picker().getByRole('button',{name:'Szukaj',exact:true}).click();await picker().getByRole('button',{name:'Wybierz benchmark: '+title,exact:true}).click();await picker().waitFor({state:'hidden'})}
async function setup(mode,count){
 await page.request.post(base+'/__acceptance/account',{data:{scenario:'normal'}});await page.request.post(base+'/__acceptance/reset');await page.request.post(base+'/__acceptance/price-data',{data:{scenario:mode}})
 await page.goto(base+'/pl/dashboard');await page.getByRole('button',{name:'Uruchom Benchmark Finder',exact:true}).click()
 await page.getByRole('button',{name:'Schowaj asystenta',exact:true}).click()
 await page.getByPlaceholder('Szukaj benchmarku, surowca, indeksu lub rynku...').fill('Oil');await page.getByRole('button',{name:'Szukaj',exact:true}).click()
 const card=page.locator('[data-testid=benchmark-result-card]').first();await card.locator('[data-pci-eligibility=SUITABLE]').waitFor()
 await page.getByLabel('Filtr przydatności do PCI').selectOption('SUITABLE');await card.locator('summary').first().click();await card.locator('summary').first().press('Enter')
 await card.locator('.bf-expand-control').click();await page.getByRole('button',{name:'Rozpocznij budowę kategorii',exact:false}).click()
 await ui().getByLabel('Nazwa kategorii').fill('Smart category')
 const names=['Oil','Energy','Copper','Aluminium','Gas']
 for(let i=1;i<count;i++)await add(names[i])
 for(let i=0;i<count;i++){await ui().getByLabel('Nazwa komponentu '+(i+1),{exact:true}).fill(names[i]);await ui().getByRole('spinbutton').nth(i).fill(count===2?i?'40':'60':'20')}
 assert.equal(await ui().locator('tr[data-component-id]').count(),count)
 await ui().getByRole('button',{name:'Dalej →',exact:true}).click()
 for(const [label,value] of [['Ostatnia cena zakupu','1000'],['Waluta zakupu','PLN'],['Jednostka zakupu','tona'],['Warunki dostawy','EXW']])await ui().getByLabel(label,{exact:true}).fill(value)
 await ui().getByLabel('Cena netto / brutto').selectOption('NET');await ui().getByRole('button',{name:'Dalej →',exact:true}).click()
 await ui().getByLabel('Data zakupu',{exact:true}).fill(mode==='monthly'?'2026-10-22':'2026-10-02')
 await ui().locator('.pci-smart-decision').waitFor()
 await page.getByRole('complementary',{name:'Sterowanie testem — tylko fixture'}).evaluate(el=>el.style.visibility='hidden')
}
try{
 for(const mode of ['normal','monthly','refusal']){
  await setup(mode,mode==='normal'?5:2)
  const text=await ui().locator('.pci-smart-decision').innerText()
  assert.match(text,mode==='normal'?/Ścisły okres zakupu/:mode==='monthly'?/Wcześniejszy okres rynkowy/:/Brak wiarygodnego/)
  for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:640},{width:2560,height:1440}]){
   await page.setViewportSize(viewport)
   for(const theme of ['Ciemny','Jasny']){
    await ui().getByRole('button',{name:theme,exact:true}).click()
    assert.equal(await ui().evaluate(el=>el.shadowRoot.querySelector('.pci-surface').dataset.srmTheme),theme==='Ciemny'?'dark':'light')
    const geometry=await ui().locator('.pci-business').evaluate(el=>{const r=el.getBoundingClientRect(),footer=el.querySelector('footer').getBoundingClientRect(),panel=el.querySelector('.v3-setup-panel');return{top:r.top,bottom:r.bottom,footerBottom:footer.bottom,panelWidth:panel.clientWidth,panelScrollWidth:panel.scrollWidth}})
    assert(geometry.bottom<=viewport.height+1);assert(geometry.footerBottom<=viewport.height+1);assert(geometry.panelScrollWidth<=geometry.panelWidth+1)
    checks.push({mode,viewport,theme,...geometry})
    if(viewport.width===390||viewport.width===1440)await page.screenshot({path:path.join(output,`${mode}-${viewport.width}-${theme}.png`)})
   }
  }
  await page.setViewportSize({width:1440,height:900})
  if(mode==='refusal'){
   assert(await ui().getByRole('button',{name:'Przeanalizuj cenę',exact:true}).isDisabled())
   assert.equal(await ui().getByLabel('Data zakupu',{exact:true}).inputValue(),'2026-10-02')
   await ui().getByRole('button',{name:'Wróć',exact:true}).click();await ui().getByRole('button',{name:'Wróć',exact:true}).click();assert.equal(await ui().locator('tr[data-component-id]').count(),2)
   await ui().getByRole('button',{name:'Wróć',exact:true}).click();continue
  }
  if(mode==='monthly'){
   const n=calls.length,consent=ui().getByRole('checkbox',{name:/Akceptuję wcześniejsze odniesienie/})
   await consent.check();await consent.uncheck();await consent.check();await page.waitForTimeout(450)
   assert.equal(calls.length,n,'consent is local: zero history or identity amplification')
  }
  await ui().getByRole('button',{name:mode==='normal'?'Przeanalizuj cenę':'Zatwierdź wcześniejszy okres i pokaż indeks rynku',exact:true}).click()
  await ui().locator('[data-flow-screen=result]').waitFor()
  assert.equal(await ui().getByRole('alert').count(),0)
  if(mode==='normal'){await ui().getByRole('heading',{name:'Ścisłe odniesienie — modelowana cena zakupu',exact:true}).waitFor();assert.equal(await ui().locator('.v3-component-line').count(),5)}
  else{await ui().getByRole('heading',{name:'Wcześniejsze proxy — wyłącznie indeks rynku',exact:true}).waitFor();await ui().getByRole('heading',{name:'Brak późniejszego punktu porównania',exact:true}).waitFor();assert.equal(await ui().locator('.pci-market-result .v3-price').count(),0);assert.doesNotMatch(await ui().locator('.pci-market-chart').innerText(),/ · 0%/);assert.match(await ui().locator('.pci-market-chart').innerText(),/poziom bazowy/)}
  await page.screenshot({path:path.join(output,mode+'-result.png')})
  await ui().getByRole('button',{name:'Gotowe, wróć do Benchmark Findera',exact:true}).click();assert.equal(await page.locator('.pci-host-dialog').count(),0)
  assert.equal(await page.getByPlaceholder('Szukaj benchmarku, surowca, indeksu lub rynku...').inputValue(),'Oil');assert.equal(await page.locator('.bf-expand-control').first().getAttribute('aria-expanded'),'true')
 }
 assert.deepEqual(errors,[])
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({status:'PASS',actualUiBffCore:true,externalAuthority:'SYNTHETIC_ONLY',checks,calls,errors},null,2));console.log('Smart preparation browser PASS: strict, proxy without money, refusal, 24 responsive/theme cases, preserved Finder context')
}finally{fs.writeFileSync(path.join(output,'diagnostics.json'),JSON.stringify({calls,errors},null,2));await browser.close()}
