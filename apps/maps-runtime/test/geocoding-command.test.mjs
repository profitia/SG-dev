import test from 'node:test'
import assert from 'node:assert/strict'
import {createMapsGeocodingCommand} from '../src/server/geocoding-command.mjs'
test('absent reviewed adoption stays zero-call even for a forged browser command',async()=>{
 let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('must not run')}
 try{const command=createMapsGeocodingCommand();assert.deepEqual(await command.run({address:'Forged',organisationId:'forged',apiKey:'forged'}),{status:'WAITING_OWNER',paidCalls:0});assert.equal(calls,0)}finally{globalThis.fetch=original}
})
test('browser-supplied feature flags or keys cannot instantiate the E1/Source adapter',()=>{
 for(const value of[{apiKey:'fake',enabled:true},{ownerAdoptionRef:'a'.repeat(40),referenceSecret:'x'.repeat(32),apiKey:'fake',service:{},source:{}}])assert.throws(()=>createMapsGeocodingCommand(value),/adoption/)
})
