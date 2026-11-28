/** Preserve the actual ingress authority for the existing Reports boundary.
 * This local GET grants no identity or access; the Reports handler rechecks E1.
 * Never infer authority from forwarding hints or copy the consumed turn body. */
export function createPublishedReportReadRequest(request:Request,producerJobId:string,signal?:AbortSignal):Request{
 const headers=new Headers()
 for(const name of ['authorization','host','origin']){const value=request.headers.get(name);if(value!==null)headers.set(name,value)}
 return new Request(new URL('/api/v1/insights/subscriptions/editions/'+encodeURIComponent(producerJobId),request.url),{
  headers,signal:AbortSignal.any([request.signal,...(signal?[signal]:[]),AbortSignal.timeout(15000)])
 })
}
