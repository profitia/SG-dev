import {test,expect} from '@playwright/test';
const widths=[390,560,768,900,1100,1440,1920,2560];
for(const width of widths)for(const theme of ['light','dark'])test(`v3 source geometry and requested typography ${width} ${theme}`,async({browser})=>{const context=await browser.newContext({viewport:{width,height:1024}});const source=await context.newPage();const actual=await context.newPage();await source.goto('https://api.magicpath.ai/components/463321469305384960/revision/465437653945430016');if(theme==='dark')await source.getByRole('button',{name:'Ciemny',exact:true}).click();await actual.goto('http://127.0.0.1:3672/v3?theme='+theme);await source.evaluate(()=>document.fonts.ready);await actual.evaluate(()=>document.fonts.ready);const measure=async(page:any)=>page.locator('.v3-app').evaluate((root:Element)=>[root,...root.querySelectorAll('h1,h2,h3,.v3-panel,.v3-intro,.v3-demo-nav,.v3-header')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,className:e.className,x:r.x,y:r.y,width:r.width,height:r.height,padding:s.padding,gap:s.gap,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,borderRadius:s.borderRadius};}));expect(await measure(actual)).toEqual(await measure(source));await context.close();});

for(const width of widths)for(const [version,component,revision,selector]of [
 ['v1','463296435564220416','465437640712400896','.cci-main'],
 ['v2','463310747150213120','465437647490396160','.ca-main']])test(`${version} source main geometry ${width} light`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1024}});const source=await context.newPage(),actual=await context.newPage();
 await source.goto(`https://api.magicpath.ai/components/${component}/revision/${revision}`);await actual.goto('http://127.0.0.1:3672/'+version);
 await source.evaluate(()=>document.fonts.ready);await actual.evaluate(()=>document.fonts.ready);
 const measure=async(page:any)=>page.locator(selector).evaluate((root:Element)=>[root,...root.querySelectorAll('h1,h2,h3,section,article,input,button,table')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,className:e.className,x:r.x,y:r.y,width:r.width,height:r.height,padding:s.padding,gap:s.gap,font:s.font,borderRadius:s.borderRadius};}));
 expect(await measure(actual)).toEqual(await measure(source));await context.close();
});
