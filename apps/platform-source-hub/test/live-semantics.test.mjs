// Offline tests only. A successful provider HTTP response is not live semantic proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTelemetry} from '../src/observability.mjs';
import {parseHubRequest,assertHubResponse} from '../../../packages/platform-source-hub-contracts/index.mjs';
import {sourceDefinition} from '../src/admission.mjs';

test('provider diagnostics use the existing bounded JSON channel without source text, identity or secret fields',()=>{
 const lines=[],t=createTelemetry(line=>lines.push(JSON.parse(line))),base={requestId:'synthetic',service:'platform-source-hub',operation:'/v1/acquire',outcome:'OK',status:200,durationMs:10};
 t.emit({...base,provider:'trading-economics',family:'news-discovery',count:2,cacheHit:false,upstreamAttempts:1,query:'PRIVATE_QUERY',token:'PRIVATE_TOKEN',organisationId:'PRIVATE_ORGANISATION',payload:{private:'PRIVATE_PAYLOAD'}});
 assert.deepEqual(lines[0],{...base,event:'source_hub_backend',provider:'trading-economics',family:'news-discovery',count:2,cacheHit:false,upstreamAttempts:1});
 t.emit({...base,provider:'PRIVATE_PROVIDER',family:'PRIVATE_FAMILY'});assert.equal(JSON.stringify(lines).includes('PRIVATE_'),false);assert.equal('upstreamAttempts' in lines[1],false);
 assert.doesNotThrow(()=>createTelemetry(()=>{throw Error('telemetry down');}).emit(base));
});
test('Markets has no default native path admission and a licence opt-in adds only five exact category paths',()=>{
 const ordinary=sourceDefinition('trading-economics','external-forecasts'),optional=sourceDefinition('trading-economics','external-forecasts',{includeMarketForecasts:true});
 assert(!ordinary.nativePathRules.some(r=>r.path?.startsWith('/markets/')));const added=optional.nativePathRules.filter(r=>r.path?.startsWith('/markets/'));
 assert.equal(added.length,5);assert(added.every(r=>r.method==='GET'&&r.requestFormat==='NONE'&&!('prefix' in r)));assert(added.some(r=>r.path==='/markets/forecasts/commodity'));
});
test('TE News remains a versioned News Discovery request, not a calendar, canonical market series or a publisher catalogue',()=>{
 const q={contractVersion:'1.0.0',provider:'trading-economics',family:'news-discovery',operation:'search',criteria:{newsType:'markets'}};
 assert.deepEqual(parseHubRequest(q),q);assert.throws(()=>parseHubRequest({...q,operation:'publishers'}));assert.throws(()=>parseHubRequest({...q,family:'market-observations'}));
 assert.throws(()=>assertHubResponse({contractVersion:'1.0.0',provider:'trading-economics',family:'news-discovery',status:'empty',items:[],coverage:{completeness:'COMPLETE'}},q));
});
