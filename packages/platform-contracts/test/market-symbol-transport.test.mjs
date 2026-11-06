import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {captureNativeTransport,nativeRequestRule,assertNativeDescriptor} from '../src/native-external-transport.mjs';
import {marketSymbolTransportSchemaUrl,marketSymbolTransportSchemaDigest} from '../src/external-call.mjs';
const rules=[{method:'GET',prefix:'/markets/historical/',parameter:'MARKET_SYMBOL',suffix:'',requestFormat:'NONE'}];
const options={schemaDigest:'a'.repeat(64),marketSymbolSchemaDigest:'b'.repeat(64),pathRules:rules,redirectOrigins:[],maximumResponseBytes:2097152,credentialMode:'SERVER_HEADERS',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'};
test('market symbols require their own opt-in digest and exact HTTPS server credential transport',()=>{
 assert(Object.isFrozen(captureNativeTransport(options,'HTTPS')));
 const {marketSymbolSchemaDigest,...ordinary}=options;assert.throws(()=>captureNativeTransport(ordinary,'HTTPS'));
 for(const change of[{marketSymbolSchemaDigest:'bad'},{credentialMode:'NONE'},{redirectOrigins:['https://other.example']},{pathRules:[{...rules[0],prefix:'/calendar/'}]},{pathRules:[{...rules[0],suffix:'/extra'}]},{pathRules:[{...rules[0],method:'POST'}]}])assert.throws(()=>captureNativeTransport({...options,...change},'HTTPS'));
 assert.throws(()=>captureNativeTransport(options,'LOCAL_SYNTHETIC_HTTP'));
});
test('canonical explicit symbol lists accept a colon, never URLs, encoded separators or wildcard authority',()=>{
 const c=captureNativeTransport(options,'HTTPS');for(const symbol of['SYNTHETIC:COM','TEST1:COM,TEST2:COM'])assert(nativeRequestRule(c,new URL('https://api.example/markets/historical/'+symbol),'GET'));
 for(const symbol of['a:com','A%3ACOM','A:COM,,B:COM','A:COM,A:COM','A:COM/other','A:COM%2fsecret','A:COM%252fsecret','A:COM%3fc=x','A*:COM','A..B:COM',Array(11).fill('A:COM').join(',')])assert.throws(()=>nativeRequestRule(c,new URL('https://api.example/markets/historical/'+symbol),'GET'),symbol);
});
test('legacy API_PATH still refuses colon symbols',()=>{
 const {marketSymbolSchemaDigest,...old}=options;const c=captureNativeTransport({...old,apiPathSchemaDigest:'c'.repeat(64),pathRules:[{method:'GET',prefix:'/calendar/',suffix:'',parameter:'API_PATH',requestFormat:'NONE'}]},'HTTPS');
 assert.throws(()=>nativeRequestRule(c,new URL('https://api.example/calendar/SYNTHETIC:COM'),'GET'));
 assert(nativeRequestRule(c,new URL('https://api.example/calendar/country/poland'),'GET'));
});
test('old native descriptors cannot authorize market symbols without the exact new installed digest',()=>{
 const c=captureNativeTransport(options,'HTTPS'),d={nativeSchemaVersion:'1.0.0',nativeSchemaDigest:c.schemaDigest,nativePolicyVersion:'1',nativeCompletionMode:c.completionMode,nativeCredentialMode:c.credentialMode,nativeMaximumResponseBytes:c.maximumResponseBytes,nativePathRules:c.pathRules,nativeRedirectOrigins:[],nativeSourceRef:'SYNTHETIC_ONLY',nativeExpiresAt:new Date(Date.now()+10000).toISOString(),marketSymbolSchemaVersion:'1.0.0',marketSymbolSchemaDigest:c.marketSymbolSchemaDigest};
 assert.doesNotThrow(()=>assertNativeDescriptor(c,d));for(const delta of[{marketSymbolSchemaDigest:undefined},{marketSymbolSchemaDigest:'c'.repeat(64)},{marketSymbolSchemaVersion:'future'}])assert.throws(()=>assertNativeDescriptor(c,{...d,...delta}));
});
test('SQL extension is byte-addressed and creates no licence, source, budget, role or service grant',async()=>{
 const bytes=readFileSync(new URL(marketSymbolTransportSchemaUrl));assert.equal(await marketSymbolTransportSchemaDigest(),createHash('sha256').update(bytes).digest('hex'));
 assert.doesNotMatch(bytes.toString(),/CREATE ROLE|INSERT INTO profitia_ingestion\.(grants|budgets)|UPDATE profitia_ingestion\.(budgets|runtime_bindings)|INSERT INTO source_hub\.provider_licences/);
});
