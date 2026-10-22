import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
const require=createRequire(import.meta.url),app=path.resolve('.');
const {build}=createRequire(require.resolve('tsx/package.json'))('esbuild');

test('approved search UI: actual browser, independent NIP, bounded autocomplete, verification, races and mobile',{timeout:120000},async()=>{
  const executable=[process.env.CHROMIUM_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>p&&fs.existsSync(p));
  assert.ok(executable,'An actual Chromium browser is required; this test must not silently skip');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'krs-name-ui-')),artifacts=path.join(app,'.next/krs-name-ui-proof');
  fs.mkdirSync(artifacts,{recursive:true});
  // A public-component fixture only. It never bypasses SRM authentication,
  // starts a provider client, or represents synthetic companies as live data.
  const source=`import React,{useState} from ${JSON.stringify(require.resolve('react'))};
import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))};
import {SupplierSearch,SupplierHeader} from '@profitia/srm-xray';
import ${JSON.stringify(path.join(app,'app/globals.css'))};
import '@profitia/srm-xray/financial-scanner.css';
import '@profitia/srm-xray/supplier-search.css';
const calls={search:0,verify:0,nip:0,name:0};window.fixtureCalls=calls;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const candidate={krs:'0000000001',name:'Fixture Engineering sp. z o.o.',nip:'5213390341',locality:'Warszawa'};
const gateway={available:async()=>!location.search.includes('disabled'),
 search:async(query,signal)=>{calls.search++;await delay(query==='slow'?800:40);if(query==='error')throw Error('Synthetic outage');
 return {coverage:'PROGRESSIVE',candidates:query==='empty'?[]:[{...candidate,krs:query==='reject'?'0000000002':candidate.krs,name:query==='slow'?'Old stale fixture':candidate.name}]};},
 verify:async(krs,signal)=>{calls.verify++;await delay(200);if(krs==='0000000002')throw Error('Synthetic identity denial');return {...candidate,selectionRef:'KRS:0000000001:'+ 'a'.repeat(64)};}};
function Fixture(){const [nip,setNip]=useState('');return <main className="appshield"><SupplierHeader/><SupplierSearch nip={nip} onNipChange={setNip} gateway={gateway} busy={false} onNipSearch={()=>{calls.nip++}} onNameSearch={()=>{calls.name++}}/><p data-fixture-only>Isolated synthetic UI fixture</p></main>}
createRoot(document.getElementById('root')).render(<Fixture/>);`;
  let browser,server;
  try{
    await build({stdin:{contents:source,resolveDir:app,sourcefile:'krs-search-fixture.tsx',loader:'tsx'},bundle:true,outfile:path.join(directory,'bundle.js'),jsx:'automatic',nodePaths:[path.join(app,'node_modules')],external:['/fonts/*','/spendguru/*'],logLevel:'silent'});
    fs.writeFileSync(path.join(directory,'index.html'),'<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
    server=http.createServer((req,res)=>{
      const pathname=new URL(req.url,'http://localhost').pathname;
      const file=pathname==='/'?path.join(directory,'index.html'):['/bundle.js','/bundle.css'].includes(pathname)?path.join(directory,pathname.slice(1))
        :/^\/(fonts|spendguru)\/[A-Za-z0-9._-]+$/.test(pathname)?path.join(app,'public',pathname):null;
      if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.woff2')?'font/woff2':'application/octet-stream');
      res.end(fs.readFileSync(file));
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const url='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.getByRole('button',{name:'Nazwa spółki',exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('button[aria-pressed="false"]').disabled);
    await page.screenshot({path:path.join(artifacts,'desktop.png'),fullPage:true});
    await page.getByLabel('Wpisz numer NIP',{exact:true}).fill('5213390341');
    await page.getByRole('button',{name:'Wyszukaj',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.fixtureCalls),{search:0,verify:0,nip:1,name:0});
    await page.getByRole('button',{name:'Nazwa spółki',exact:true}).click();
    const input=page.getByRole('combobox');await input.fill('Fixture');
    await page.getByRole('option').waitFor();
    assert.equal(await input.getAttribute('aria-expanded'),'true');
    assert.equal(await page.evaluate(()=>window.fixtureCalls.name),0);
    assert.equal(await page.evaluate(()=>window.fixtureCalls.verify),0);
    await input.press('ArrowDown');assert.ok(await input.getAttribute('aria-activedescendant'));
    await input.press('Enter');await page.getByText('Wybrana spółka',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.fixtureCalls.verify),1);
    assert.equal(await page.evaluate(()=>window.fixtureCalls.name),0);
    await page.getByRole('button',{name:'Wyszukaj',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.fixtureCalls.name),1);
    await page.getByRole('button',{name:'Zmień',exact:true}).click();await input.fill('empty');
    await page.getByText('Brak dopasowań w dostępnym katalogu',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Wyszukaj',exact:true}).isEnabled(),false);
    await input.fill('error');await page.getByText('Nie udało się pobrać podpowiedzi.',{exact:true}).waitFor();
    const before=await page.evaluate(()=>window.fixtureCalls.search);await page.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();
    await page.waitForFunction(previous=>window.fixtureCalls.search>previous,before);
    await input.fill('reject');await page.getByRole('option').waitFor();await page.getByRole('option').click();
    await page.getByRole('alert').filter({hasText:'Nie udało się potwierdzić danych'}).waitFor();
    assert.equal(await page.evaluate(()=>window.fixtureCalls.name),1);
    await input.fill('slow');await page.waitForTimeout(350);await input.fill('Fixture');
    await page.getByRole('option').filter({hasText:'Fixture Engineering'}).waitFor();await page.waitForTimeout(850);
    assert.equal(await page.getByText('Old stale fixture',{exact:true}).count(),0);
    await page.getByRole('option').click();await page.getByRole('button',{name:'Wyczyść wyszukiwanie',exact:true}).click();await page.waitForTimeout(300);
    assert.equal(await page.getByText('Wybrana spółka',{exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Wyszukaj',exact:true}).isEnabled(),false);
    await input.fill('Fixture');await page.getByRole('option').waitFor();
    await page.screenshot({path:path.join(artifacts,'autocomplete.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:path.join(artifacts,'mobile.png'),fullPage:true});
    await page.goto(url+'/?disabled');await page.getByText('Wyszukiwanie po nazwie jest obecnie niedostępne. Możesz wyszukać po NIP.').waitFor();
    assert.equal(await page.getByRole('button',{name:'Nazwa spółki',exact:true}).isEnabled(),false);
    await page.getByLabel('Wpisz numer NIP',{exact:true}).fill('5213390341');await page.getByRole('button',{name:'Wyszukaj',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.fixtureCalls),{search:0,verify:0,nip:1,name:0});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(artifacts,'proof.json'),JSON.stringify({scope:'ISOLATED_SYNTHETIC_UI_ONLY',browser:'Chromium',nipRegression:'PASS',keyboard:'PASS',mouse:'PASS',emptyErrorRetry:'PASS',debounceAbortRaces:'PASS',mobile:'PASS',networkProviderCalls:0,liveCatalogOrFinancialUat:false},null,2));
  }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});}
});
