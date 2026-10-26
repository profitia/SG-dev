import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
const widths=[390,560,768,900,1100,1440,1920,2560];
const actualOrigin=process.env.PCI_BASE_URL??'http://127.0.0.1:3672';
const compareSource=process.env.PCI_COMPARE_MAGICPATH==='1';
async function ready(page:Page){await page.evaluate(()=>document.fonts.ready);}
for(const width of widths)for(const theme of ['light','dark'])test(`v3 source and approved canon geometry ${width} ${theme}`,async({browser},info)=>{
 test.skip(!compareSource,'Live-source comparison runs explicitly on a host with verified source fonts; CI runs deterministic local checks.');
 const context=await browser.newContext({viewport:{width,height:1024}});const source=await context.newPage(),actual=await context.newPage();
 await source.goto('https://api.magicpath.ai/components/463321469305384960/revision/465437653945430016');if(theme==='dark')await source.getByRole('button',{name:'Ciemny',exact:true}).click();await actual.goto(actualOrigin+'/v3?theme='+theme);await ready(source);await ready(actual);
 const measure=async(page:Page)=>page.locator('.v3-app').evaluate(root=>[root,...root.querySelectorAll('h1,h2,h3,.v3-panel,.v3-intro,.v3-demo-nav,.v3-header')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,className:e.className,x:r.x,y:r.y,width:r.width,height:r.height,padding:s.padding,gap:s.gap,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,borderRadius:s.borderRadius,color:s.color,background:s.backgroundColor};}));
 const original=await measure(source),received=await measure(actual);const expected=structuredClone(original);
 // Owner-approved exception: current library actionHeight=32, actionFont=12;
 // original v3 fallback was 38/13. Record original measurements, never alter MagicPath.
 const originalButton=await source.locator('.v3-intro>.v3-primary').evaluate(e=>e.getBoundingClientRect().height);
 const canonButton=await actual.locator('.v3-intro>.v3-primary').evaluate(e=>{const s=getComputedStyle(e);return {height:e.getBoundingClientRect().height,minHeight:s.minHeight,font:s.fontSize,padding:s.padding,border:s.borderWidth,lineHeight:s.lineHeight};});
 expect(originalButton).toBe(38);expect(canonButton).toEqual({height:34.1875,minHeight:'32px',font:'12px',padding:'8px 12px',border:'1px',lineHeight:'16.2px'});
 const delta=originalButton-canonButton.height;let card=-1;
 for(const row of expected){if(row.className==='v3-app srm-ui')row.height=Math.max(1024,row.height-(width<=900?3:2)*delta);if(row.className==='v3-intro')row.height-=delta;if(row.className==='v3-panel'){card++;row.y-=(width<=900&&card===2?2:1)*delta;if(width>900||card>0)row.height-=delta;}else if(row.tag==='H3'&&card>=0)row.y-=(width<=900&&card===2?2:1)*delta;}
 await fs.writeFile(info.outputPath('source-and-actual.json'),JSON.stringify({pin:'465437653945430016',library:'464039002702499840',approvedException:'Owner selected current library geometry 32px/12px on 2026-10-26',width,theme,original,received,expected},null,2));
 await source.screenshot({path:info.outputPath('magicpath.png'),fullPage:true});await actual.screenshot({path:info.outputPath('frontend.png'),fullPage:true});
 expect(received).toEqual(expected);await context.close();
});
for(const width of widths)for(const [version,component,revision,selector]of [
 ['v1','463296435564220416','465437640712400896','.cci-main'],
 ['v2','463310747150213120','465437647490396160','.ca-main']])test(`${version} source main geometry ${width} light`,async({browser},info)=>{
 test.skip(!compareSource,'Live-source comparison requires the verified Inter 3.019 source environment.');
 const context=await browser.newContext({viewport:{width,height:1024}});const source=await context.newPage(),actual=await context.newPage();
 await source.goto(`https://api.magicpath.ai/components/${component}/revision/${revision}`);await actual.goto(actualOrigin+'/'+version);await ready(source);await ready(actual);
 const measure=async(page:Page)=>page.locator(selector).evaluate(root=>[root,...root.querySelectorAll('h1,h2,h3,section,article,input,button,table')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,className:e.className,x:r.x,y:r.y,width:r.width,height:r.height,padding:s.padding,gap:s.gap,font:s.font,borderRadius:s.borderRadius,color:s.color,background:s.backgroundColor};}));
 const original=await measure(source),received=await measure(actual);await fs.writeFile(info.outputPath('source-and-actual.json'),JSON.stringify({revision,width,original,received},null,2));await source.screenshot({path:info.outputPath('magicpath.png'),fullPage:true});await actual.screenshot({path:info.outputPath('frontend.png'),fullPage:true});expect(received).toEqual(original);await context.close();
});
for(const width of widths)for(const theme of ['light','dark'])for(const version of ['v1','v2','v3'])test(`local responsive controls ${version} ${width} ${theme}`,async({page},info)=>{
 await page.setViewportSize({width,height:1024});await page.goto('/'+version+'?theme='+theme);await ready(page);
 await expect(page.locator('.pci-surface')).toHaveAttribute('data-srm-theme',theme);await expect(page.locator('h1')).toBeVisible();await expect(page.getByRole('button',{name:'Jasny',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Ciemny',exact:true})).toBeVisible();
 expect(await page.locator('[data-price-change-index]').evaluate(e=>e.getBoundingClientRect().width)).toBe(width);
 await page.screenshot({path:info.outputPath('responsive.png'),fullPage:true});
});
const sourcePins={v1:['463296435564220416','465437640712400896','.cci-root'],v2:['463310747150213120','465437647490396160','.ca-root'],v3:['463321469305384960','465437653945430016','.v3-app']} as const;
type Version=keyof typeof sourcePins;
const click=(name:string)=>(p:Page)=>p.getByRole('button',{name,exact:true}).click();
const cases:{version:Version;name:string;actions:((p:Page)=>Promise<unknown>)[]}[]=[
 {version:'v1',name:'menu edge selection',actions:[click('Rozwiń menu'),click('Pozycja menu'),p=>p.getByRole('option',{name:'Prawa krawędź',exact:true}).click()]},
 {version:'v2',name:'menu edge selection',actions:[click('Rozwiń menu'),click('Pozycja menu'),p=>p.getByRole('option',{name:'Prawa krawędź',exact:true}).click()]},
 {version:'v1',name:'menu open',actions:[click('Rozwiń menu')]},
 {version:'v2',name:'menu open',actions:[click('Rozwiń menu')]},
 {version:'v1',name:'home',actions:[click('01 Moje modele')]},
 {version:'v1',name:'configuration',actions:[click('02 Konfiguracja CCI')]},
 {version:'v1',name:'component detail',actions:[click('04 Szczegóły komponentu')]},
 {version:'v1',name:'methodology',actions:[click('Metodologia')]},
 {version:'v1',name:'versions',actions:[click('Model v1')]},
 {version:'v1',name:'price simulation',actions:[p=>p.getByRole('button',{name:/Moja cena/}).click()]},
 {version:'v1',name:'new category selection',actions:[click('01 Moje modele'),p=>p.getByRole('button',{name:/Nowy indeks kosztowy/}).click()]},
 {version:'v1',name:'advanced disclosure',actions:[click('02 Konfiguracja CCI'),p=>p.locator('.cci-advanced summary').click()]},
 {version:'v2',name:'setup structure',actions:[click('Rozpocznij analizę ceny')]},
 {version:'v2',name:'setup purchase',actions:[click('Rozpocznij analizę ceny'),click('Dalej')]},
 {version:'v2',name:'setup date',actions:[click('Rozpocznij analizę ceny'),click('Dalej'),click('Dalej')]},
 {version:'v2',name:'monitoring',actions:[click('03 Monitorowanie ceny')]},
 {version:'v2',name:'comparison',actions:[click('04 Weryfikacja oferty')]},
 {version:'v2',name:'saved',actions:[click('05 Zapisane analizy')]},
 {version:'v2',name:'methodology',actions:[click('03 Monitorowanie ceny'),click('Jak to liczymy?')]},
 {version:'v2',name:'history',actions:[click('03 Monitorowanie ceny'),click('Historia')]},
 {version:'v2',name:'component',actions:[click('03 Monitorowanie ceny'),p=>p.locator('.ca-driver-row').first().click()]},
 {version:'v2',name:'breakdown disclosure',actions:[click('03 Monitorowanie ceny'),p=>p.locator('.ca-drivers summary').click()]},
 {version:'v3',name:'direct structure',actions:[click('Bezpośrednio')]},
 {version:'v3',name:'benchmark structure',actions:[click('Z Benchmark Finder')]},
 {version:'v3',name:'supplier structure',actions:[click('Z SRM')]},
 {version:'v3',name:'purchase step',actions:[click('Bezpośrednio'),click('Dalej →')]},
 {version:'v3',name:'date step',actions:[click('Bezpośrednio'),click('Dalej →'),click('Dalej →')]},
 {version:'v3',name:'result monitoring',actions:[click('Wynik analizy')]},
 {version:'v3',name:'result comparison',actions:[click('Wynik analizy'),click('Sprawdź ofertę dostawcy')]},
 {version:'v3',name:'saved analyses',actions:[click('Moje analizy')]},
 {version:'v3',name:'component details',actions:[click('Wynik analizy'),p=>p.locator('.v3-component-line').first().click()]},
];
for(const scenario of cases)test(`paired source behavior and inner styles ${scenario.version} ${scenario.name}`,async({browser},info)=>{
 test.skip(!compareSource,'Explicit live-source comparison.');
 const [component,revision,rootSelector]=sourcePins[scenario.version];const context=await browser.newContext({viewport:{width:1440,height:1024},reducedMotion:'reduce'});const source=await context.newPage(),actual=await context.newPage();
 await source.goto(`https://api.magicpath.ai/components/${component}/revision/${revision}`);await actual.goto(actualOrigin+'/'+scenario.version);await ready(source);await ready(actual);
 for(const action of scenario.actions){await action(source);await action(actual);}
 await source.mouse.move(0,0);await actual.mouse.move(0,0);
 const visibleText=async(page:Page)=>(await page.locator(rootSelector).innerText()).replace(/Jasny\s*Ciemny/g,'').replace(/\s+/g,' ').trim();expect(await visibleText(actual)).toEqual(await visibleText(source));
 const measure=async(page:Page)=>page.locator(rootSelector).evaluate(root=>[root,...root.querySelectorAll('*')].filter(e=>e instanceof HTMLElement&&!['STYLE','SCRIPT','OPTION'].includes(e.tagName)&&!e.closest('.srm-theme-switch')).map(e=>{const s=getComputedStyle(e);return {tag:e.tagName,className:e.className,padding:s.padding,gap:s.gap,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,borderRadius:s.borderRadius,color:s.color,background:s.backgroundColor,borderColor:s.borderColor,borderWidth:s.borderWidth,minHeight:s.minHeight};}));
 const original=await measure(source),received=await measure(actual);const expected=structuredClone(original);if(scenario.version==='v3')for(const [i,row]of expected.entries()){if(row.className.split(' ').includes('v3-primary')){row.fontSize='12px';row.lineHeight='16.2px';row.minHeight='32px';}}
 await fs.writeFile(info.outputPath('source-and-actual.json'),JSON.stringify({scenario:scenario.name,revision,original,received,expected},null,2));await source.screenshot({path:info.outputPath('magicpath.png'),fullPage:true});await actual.screenshot({path:info.outputPath('frontend.png'),fullPage:true});expect(received).toEqual(expected);await context.close();
});
