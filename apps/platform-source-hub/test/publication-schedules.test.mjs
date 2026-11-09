// SYNTHETIC_ONLY. Published-provider schedules are never archived as fixtures.
import test from 'node:test'
import assert from 'node:assert/strict'
import {parseHubRequest,assertHubResponse} from '../../../packages/platform-source-hub-contracts/index.mjs'
import {createEiaProvider,prepareEia} from '../src/providers/eia.mjs'
import {createCommoditiesProvider} from '../src/providers/commodities-sh.mjs'
import {parseEiaSchedule} from '../src/providers/eia-schedules.mjs'
import {zonedInstant} from '../src/providers/publication-schedules.mjs'
import {sourceDefinition,COMMODITY_SOURCE_DEFINITIONS} from '../src/admission.mjs'
import {getCatalogue} from '../src/capabilities.mjs'
const q=(publication='wpsr',from='2026-10-28',to='2026-11-13')=>({contractVersion:'1.2.0',provider:'eia',family:'publication-calendar',operation:'calendar',criteria:{publication,from,to}})
const cq={contractVersion:'1.2.0',provider:'commodities-sh',family:'publication-calendar',operation:'calendar',criteria:{}}
export const wpsrHtml=(row='<td>November 6, 2026</td><td>November 12, 2026</td><td>Thursday</td><td>12:00 p.m.</td><td>SYNTHETIC holiday exception</td>')=>`<html><h1>Weekly Petroleum Status Report Schedule</h1><p>The standard release time and day of the week will be at 10:30 a.m. eastern time on Wednesday with the following exceptions.</p><table><tr><th>Data for the week ending</th><th>Alternate release date</th><th>Release day</th><th>Release time</th><th>Holiday</th></tr><tr>${row}</tr></table></html>`
const admitted=r=>{const receipt='00000000-0000-4000-8000-000000000001';r.provenance.licenceRef='SYNTHETIC_ONLY';r.usage.receiptRef=receipt;for(const i of r.items)Object.assign(i.metadata,{licenceRef:'SYNTHETIC_ONLY',usageReceiptRef:receipt,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY',retentionUntil:null});return r}
test('new contract is closed, calendar-only and preserves the legacy family allowlist',()=>{
 assert.deepEqual(parseHubRequest(q()),q());assert.deepEqual(parseHubRequest(cq),cq)
 assert.equal(Object.keys(COMMODITY_SOURCE_DEFINITIONS).length,6)
 for(const bad of [{...q(),contractVersion:'1.1.0'},{...q(),provider:'cftc'},{...q(),family:'series-observations'},{...q(),criteria:{...q().criteria,url:'https://example.com'}},{...q(),criteria:{...q().criteria,from:'2026-02-30'}},{...q(),criteria:{...q().criteria,publication:'unknown'}},{...q(),criteria:{...q().criteria,to:'2030-01-01'}},{...cq,criteria:{endpoint:'price'}}])assert.throws(()=>parseHubRequest(bad))
 assert.equal(prepareEia(q()).url,'https://www.eia.gov/petroleum/supply/weekly/schedule.php')
 assert.equal(prepareEia(q('steo')).url,'https://www.eia.gov/outlooks/steo/release_schedule.php')
 const d=sourceDefinition('eia','publication-calendar');assert.equal(d.origin,'https://www.eia.gov');assert.deepEqual(d.pathRules.map(r=>r.path),['/petroleum/supply/weekly/schedule.php','/outlooks/steo/release_schedule.php']);assert(!d.nativePathRules.some(r=>'prefix'in r))
 assert.equal(getCatalogue({}).publicationScheduleContracts.providers[1].activation,'NOT_ACTIVATED')
})
test('IANA conversion crosses DST and rejects ambiguous, missing and invalid wall clocks',()=>{
 assert.equal(zonedInstant('2026-10-28T10:30'),'2026-10-28T14:30:00.000Z')
 assert.equal(zonedInstant('2026-11-04T10:30'),'2026-11-04T15:30:00.000Z')
 for(const s of ['2026-11-01T01:30','2026-03-08T02:30','2026-02-30T10:30'])assert.throws(()=>zonedInstant(s))
})
test('official exception displaces the Wednesday even for a Thursday-only query; rules stay explicitly provisional',()=>{
 const items=parseEiaSchedule(wpsrHtml(),q()),exception=items.find(i=>i.scheduleStatus==='OFFICIAL_EXCEPTION')
 assert.equal(items.length,3);assert.equal(exception.scheduledAt,'2026-11-12T17:00:00.000Z');assert.equal(exception.referencePeriod,'2026-11-06');assert.equal(exception.exception.standardDate,'2026-11-11');assert.equal(exception.timeZone,'America/New_York');assert(!items.some(i=>i.dateOnly==='2026-11-11'))
 assert.equal(parseEiaSchedule(wpsrHtml(),q('wpsr','2026-11-12','2026-11-12')).length,1)
 assert(items.filter(i=>i!==exception).every(i=>i.scheduleStatus==='RULE_DERIVED_UNCONFIRMED'))
 assert(items.every(i=>i.actual===null&&i.publishedAt===null&&i.sourceUpdatedAt===null&&i.lastVerifiedAt==='metadata.retrievedAt'))
})
test('known-source parser fails closed for changed structure, contradictory weekday, missing exception table and duplicate references',()=>{
 const html=wpsrHtml();for(const s of [html.replace('Alternate release date','Changed heading'),html.replace('Thursday','Friday'),html.replace('10:30 a.m.','11:30 a.m.'),'<html>unavailable</html>',html.replace('</table>',html.match(/<tr><td>[\s\S]*?<\/tr>/)[0]+'</table>')])assert.throws(()=>parseEiaSchedule(s,q()),{code:'PROVIDER_SCHEMA_CHANGED'})
})
test('STEO is a dated issue with its usual release window, not an exact timestamp or actual result',()=>{
 const html='<html><h1>Short-Term Energy Outlook</h1><p>normally released between 12:00 pm (noon) and 12:15 pm EDT (summer)/EST (winter)</p><table><tr><th>Issue</th><th>Release date</th><th>Notes</th></tr><tr><td>November 2026</td><td>11/10/2026</td><td></td></tr></table></html>'
 const [p]=parseEiaSchedule(html,q('steo','2026-11-01','2026-11-30'))
 assert.equal(p.timePrecision,'TIME_WINDOW');assert.equal(p.scheduledAt,'2026-11-10T17:00:00.000Z');assert.equal(p.scheduledUntil,'2026-11-10T17:15:00.000Z');assert.equal(p.referencePeriod,'2026-11');assert.equal(p.scheduleId,null)
})
test('admitted EIA acquisition validates through the real response contract without API keys, raw HTML or invented publication times',async()=>{
 let calls=0;const adapter=createEiaProvider({fetchImpl:async(url,options)=>{calls++;assert.equal(url,prepareEia(q()).url);assert.equal(options.headers.Accept,'text/html');assert.equal(options.redirect,'error');return new Response(wpsrHtml())}})
 const a=admitted(await adapter.acquire(q())),b=admitted(await adapter.acquire(q()));assert.equal(calls,2);assertHubResponse(a,q());assertHubResponse(b,q())
 assert.deepEqual(a.items.map(i=>i.metadata.contentFingerprint),b.items.map(i=>i.metadata.contentFingerprint));assert(!JSON.stringify(a).includes('<html>'))
 const forged=structuredClone(a);forged.items[0].payload.actual=1;assert.throws(()=>assertHubResponse(forged,q()),{code:'INVALID_UPSTREAM_RESPONSE'})
})
test('commodities source identities survive reorder; no ID becomes an explicit correlation hint, never an array index',async()=>{
 const rows=[{id:'SYNTHETIC-WPSR',name:'Synthetic petroleum report',cadence:'weekly',typical_time_et:'Wednesday 10:30',next_release_at:'2026-11-12T17:00:00Z'},{name:'Synthetic publication',frequency:'monthly',date:'2026-11-10'}]
 const run=async data=>admitted(await createCommoditiesProvider({fetchImpl:async()=>Response.json({events:data})}).acquire(cq))
 const a=await run(rows),b=await run([...rows].reverse());assertHubResponse(a,cq)
 const byTitle=r=>Object.fromEntries(r.items.map(i=>[i.payload.title,i.metadata.contentFingerprint]));assert.deepEqual(byTitle(a),byTitle(b))
 const missing=a.items.find(i=>i.payload.scheduleId===null).payload;assert.equal(missing.identityStatus,'CORRELATION_ONLY');assert(missing.qualityFlags.includes('NO_PROVIDER_STABLE_EVENT_ID'));assert.equal(missing.scheduledAt,null);assert.equal(missing.timePrecision,'DATE')
 assert.equal(a.items[0].payload.recurrence,'weekly');assert.equal(a.items[0].payload.timeZone,'America/New_York')
 await assert.rejects(run([rows[0],rows[0]]),{code:'PROVIDER_SCHEMA_CHANGED'})
 const changed=await run([{...rows[0],next_release_at:'2026-11-13T17:00:00Z'}]);assert.equal(changed.items[0].payload.correlationKey,a.items[0].payload.correlationKey);assert.notEqual(changed.items[0].metadata.contentFingerprint,a.items[0].metadata.contentFingerprint)
})
test('provider denial, timeout, malformed HTML and unavailable transport remain controlled errors',async()=>{
 for(const [response,code] of [[new Response('',{status:403}),'PROVIDER_FORBIDDEN'],[new Response('',{status:429}),'RATE_LIMITED'],[new Response('<html>changed</html>'),'PROVIDER_SCHEMA_CHANGED']])await assert.rejects(createEiaProvider({fetchImpl:async()=>response}).acquire(q()),{code})
 await assert.rejects(createEiaProvider().acquire(q()),{code:'ADMITTED_TRANSPORT_REQUIRED'})
 const abort=new AbortController();abort.abort();await assert.rejects(createEiaProvider({fetchImpl:async(_u,o)=>{o.signal.throwIfAborted()}}).acquire(q(),{signal:abort.signal}),{code:'TIMEOUT'})
})
