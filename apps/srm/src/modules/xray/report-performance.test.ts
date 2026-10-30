import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeReportResourceTiming} from './report-performance';
const origin='https://srm-development-runtime.onrender.com';
const resource=(change={})=>({name:origin+'/api/xray/search',entryType:'resource',initiatorType:'fetch',startTime:110,requestStart:120,responseStart:850,responseEnd:900,nextHopProtocol:'h2',transferSize:1200,encodedBodySize:1000,decodedBodySize:2500,...change});
test('separates request dispatch, response, body, local handling and paint opportunity without supplier data',()=>{
 const value=summarizeReportResourceTiming([resource()],origin,100,940,960);
 assert.deepEqual(value,{status:'OBSERVED',beforeRequestMs:10,responseWaitMs:730,bodyTransferMs:50,afterResponseToControllerMs:40,controllerToPaintOpportunityMs:20,protocol:'h2',transferBytes:1200,encodedBodyBytes:1000,decodedBodyBytes:2500});
 assert(!JSON.stringify(value).includes(origin));assert(!JSON.stringify(value).includes('/api/'));
});
test('reports a long transfer separately from a long local scheduling delay',()=>{
 assert.equal(summarizeReportResourceTiming([resource({responseEnd:20900})],origin,100,20940,20960).status,'OBSERVED');
 const transfer=summarizeReportResourceTiming([resource({responseEnd:20900})],origin,100,20940,20960);
 const local=summarizeReportResourceTiming([resource()],origin,100,20940,20960);
 if(transfer.status!=='OBSERVED'||local.status!=='OBSERVED')assert.fail('Expected complete timing');
 assert.equal(transfer.bodyTransferMs,20050);assert.equal(local.bodyTransferMs,50);assert.equal(local.afterResponseToControllerMs,20040);
});
test('excludes another origin, another route and preceding searches; does not pick an ambiguous request',()=>{
 assert.deepEqual(summarizeReportResourceTiming([resource({name:'https://foreign.invalid/api/xray/search'}),resource({name:origin+'/api/xray/krs/status'}),resource({startTime:50})],origin,100,940,960),{status:'MISSING'});
 assert.deepEqual(summarizeReportResourceTiming([resource(),resource()],origin,100,940,960),{status:'AMBIGUOUS'});
});
test('redacted, malformed, unfinished and nonmonotonic phases remain unavailable',()=>{
 for(const change of[{requestStart:0},{requestStart:100},{responseStart:NaN},{responseEnd:800},{responseEnd:950}])
  assert.deepEqual(summarizeReportResourceTiming([resource(change)],origin,100,940,960),{status:'UNAVAILABLE'});
 assert.deepEqual(summarizeReportResourceTiming([resource()],origin,100,90,960),{status:'UNAVAILABLE'});
});
