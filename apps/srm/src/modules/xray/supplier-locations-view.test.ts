import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {SupplierLocations,SupplierLocationMapPanel} from './supplier-locations-view'
import type {SupplierLocationPage} from '@profitia/srm-xray'
import {mountSupplierMapWithStartupRetry} from './supplier-map-startup'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import receipt from '../../../operation-integration.json'
test('map startup repair preserves every prior acceptance and pins current consumer bytes',()=>{
 const a=receipt.supplierMapStartupRepair,hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(before.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests)){
  const next:{previousReceiptSourceSha:string;applicationSourceDigests:Record<string,string>}=receipt.supplierMapRuntimeReadinessRepair
  const latest:{previousReceiptSourceSha:string;applicationSourceDigests:Record<string,string>}=receipt.supplierMapAddressOnlyRepair
  const final:{previousReceiptSourceSha:string;applicationSourceDigests:Record<string,string>}=receipt.supplierMapGeocodingActivation
  const bytes=next?.applicationSourceDigests[file]?execFileSync('git',['show',next.previousReceiptSourceSha+':apps/srm/'+file]):latest?.applicationSourceDigests[file]?execFileSync('git',['show',latest.previousReceiptSourceSha+':apps/srm/'+file]):final?.applicationSourceDigests[file]?execFileSync('git',['show',final.previousReceiptSourceSha+':apps/srm/'+file]):(receipt.fullUiParityAdoption?.applicationSourceDigests as Record<string,string>)[file]?execFileSync('git',['show',receipt.fullUiParityAdoption.previousReceiptSourceSha+':apps/srm/'+file]):readFileSync(new URL('../../../'+file,import.meta.url))
  assert.equal(hash(bytes),digest,file)
 }
 assert.equal(a.maximumAutomaticStartupRetries,1);assert.equal(a.sharedSdkChanged,false);assert.equal(a.locationAuthorityChanged,false)
})
test('address-only and empty authorized pages display the map without claiming a supplier position',()=>{
 for(const items of [[],[{id:'address-only',label:'Fixture',address:{line1:'Testowa 1',postalCode:'00-001',locality:'Warszawa',country:'Polska'},lifecycle:'ACTIVE',coordinates:null}]]){
  const page={items,total:items.length} as unknown as SupplierLocationPage
  const html=renderToStaticMarkup(React.createElement(SupplierLocationMapPanel,{page,mapRef:null,status:'loading',onRetry(){}}))
  assert.match(html,/aria-label="Mapa zapisanych lokalizacji"/)
  assert.match(html,/srm-supplier-map-canvas/);assert.match(html,/Wczytywanie mapy/);assert.match(html,/Mapa pokazuje widok ogólny/)
  assert.doesNotMatch(html,/Mapa lokalizacji jest gotowa|position|latitude|longitude/)
 }
})
test('map unavailability remains explicit and offers retry without hiding an address-only page',()=>{
 const page={items:[],total:0} as unknown as SupplierLocationPage
 const html=renderToStaticMarkup(React.createElement(SupplierLocationMapPanel,{page,mapRef:null,status:'error',onRetry(){}}))
 assert.match(html,/role="alert"/);assert.match(html,/Mapa jest chwilowo niedostępna/);assert.match(html,/Spróbuj ponownie/)
 assert.doesNotMatch(html,/Mapa lokalizacji jest gotowa/)
})
test('address-only repair preserves predecessor receipts and pins current source',()=>{
 const a=receipt.supplierMapAddressOnlyRepair,hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
 const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(prior),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(prior.toString())))assert.deepEqual((receipt as Record<string,unknown>)[k],v,k)
 for(const[f,d]of Object.entries(a.applicationSourceDigests)){
  const next:{previousReceiptSourceSha:string;applicationSourceDigests:Record<string,string>}=receipt.supplierMapGeocodingActivation
  const bytes=next?.applicationSourceDigests[f]?execFileSync('git',['show',next.previousReceiptSourceSha+':apps/srm/'+f]):readFileSync(new URL('../../../'+f,import.meta.url))
  assert.equal(hash(bytes),d,f)
 }
 assert.equal(a.inventedCoordinates,false);assert.equal(a.paidGeocodingEnabled,false);assert.equal(a.sharedSdkChanged,false)
})
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
test('failed startup gets one new channel, old callbacks are fenced and successful map closes cleanly',async()=>{
 const callbacks:((s:'ready'|'error')=>void)[]=[],closed:number[]=[],states:string[]=[]
 const map=mountSupplierMapWithStartupRetry(status=>{const id=callbacks.push(status);return {close(){closed.push(id)}}},s=>states.push(s))
 callbacks[0]('error');await flush();assert.equal(callbacks.length,2);assert.deepEqual(closed,[1]);assert.deepEqual(states,[])
 callbacks[0]('ready');await flush();assert.deepEqual(states,[])
 callbacks[1]('ready');await flush();assert.deepEqual(states,['ready'])
 map.close();map.close();assert.deepEqual(closed,[1,2])
})
test('repeated startup failure is bounded and leaves the existing unavailable action',async()=>{
 let calls=0;const states:string[]=[]
 const map=mountSupplierMapWithStartupRetry(status=>{calls++;status('error');return {close(){}}},s=>states.push(s))
 await flush();assert.equal(calls,2);assert.deepEqual(states,['error']);map.close()
})
test('closing the dialog before a queued startup failure prevents another mount or stale status',async()=>{
 let calls=0,closed=0;const states:string[]=[]
 const map=mountSupplierMapWithStartupRetry(status=>{calls++;status('error');return {close(){closed++}}},s=>states.push(s))
 map.close();await flush();assert.equal(calls,1);assert.equal(closed,1);assert.deepEqual(states,[])
})
test('a previously ready map never silently restarts after losing its protected channel',async()=>{
 let callback!:(s:'ready'|'error')=>void,calls=0;const states:string[]=[]
 const map=mountSupplierMapWithStartupRetry(status=>{calls++;callback=status;return {close(){}}},s=>states.push(s))
 callback('ready');await flush();callback('error');await flush();assert.equal(calls,1);assert.deepEqual(states,['ready','error']);map.close()
})
test('synchronous startup errors use the same bounded recovery',async()=>{
 let calls=0;const states:string[]=[]
 const map=mountSupplierMapWithStartupRetry(status=>{if(++calls===1)throw Error('runtime unavailable');status('ready');return {close(){}}},s=>states.push(s))
 await flush();assert.equal(calls,2);assert.deepEqual(states,['ready']);map.close()
})
test('closed MAP-01 entry is an accessible icon and does not eagerly mount a map or modal',()=>{
 const html=renderToStaticMarkup(React.createElement(SupplierLocations,{supplierId:'11111111-1111-4111-8111-111111111111',refreshKey:'accepted-v1'}))
 assert.match(html,/aria-label="Otwórz lokalizację dostawcy w Google Maps"/)
 assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/aria-expanded="false"/)
 assert.match(html,/maps_48dp.png/);assert.match(html,/width="30" height="30" alt=""/)
 assert.doesNotMatch(html,/<dialog|<iframe|maps.googleapis.com|<script|Podmioty powiązane/)
 assert.equal((html.match(/<button/g)??[]).length,1)
})
