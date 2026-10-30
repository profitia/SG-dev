type Resource = Pick<PerformanceResourceTiming,'name'|'entryType'|'initiatorType'|'startTime'|'requestStart'|'responseStart'|'responseEnd'|'nextHopProtocol'|'transferSize'|'encodedBodySize'|'decodedBodySize'>;
const unavailable=(status:'UNAVAILABLE'|'MISSING'|'AMBIGUOUS')=>({status} as const);
const bytes=(value:number)=>Number.isSafeInteger(value)&&value>=0?value:null;
const ms=(value:number)=>Math.round(value*100)/100;

/** Browser-observed phases only. No URL, NIP, cookie, bearer or response body
 * enters diagnostics. Waiting for response includes the remote server/proxy;
 * time after response includes parsing and local scheduling, not just paint. */
export function summarizeReportResourceTiming(entries:readonly Resource[],origin:string,start:number,controller:number,end:number){
 if(![start,controller,end].every(Number.isFinite)||start<0||controller<start||end<controller)return unavailable('UNAVAILABLE');
 const found=entries.filter(e=>{
  try{return e.entryType==='resource'&&e.initiatorType==='fetch'&&new URL(e.name).origin===origin
   &&new URL(e.name).pathname==='/api/xray/search'&&e.startTime>=start-1&&e.responseEnd<=end+1}catch{return false}
 });
 if(found.length!==1)return unavailable(found.length?'AMBIGUOUS':'MISSING');
 const e=found[0];
 if(![e.startTime,e.requestStart,e.responseStart,e.responseEnd].every(Number.isFinite)||e.requestStart<=0
  ||e.requestStart<e.startTime||e.responseStart<e.requestStart||e.responseEnd<e.responseStart||e.responseEnd>controller+1)
  return unavailable('UNAVAILABLE');
 return {status:'OBSERVED' as const,beforeRequestMs:ms(e.requestStart-e.startTime),
  responseWaitMs:ms(e.responseStart-e.requestStart),bodyTransferMs:ms(e.responseEnd-e.responseStart),
  afterResponseToControllerMs:ms(Math.max(0,controller-e.responseEnd)),controllerToPaintOpportunityMs:ms(end-controller),
  protocol:/^[a-z0-9./-]{1,32}$/i.test(e.nextHopProtocol)?e.nextHopProtocol:null,
  transferBytes:bytes(e.transferSize),encodedBodyBytes:bytes(e.encodedBodySize),decodedBodyBytes:bytes(e.decodedBodySize)};
}
export function observeReportResourceTiming(start:number,controller:number,end:number){
 try{return summarizeReportResourceTiming(performance.getEntriesByType('resource') as PerformanceResourceTiming[],window.location.origin,start,controller,end)}
 catch{return unavailable('UNAVAILABLE')}
}
