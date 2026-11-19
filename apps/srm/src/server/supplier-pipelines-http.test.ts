import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupplierPipelinesHttp} from './supplier-pipelines-http';
import type {SupplierPipelinesHttpPort} from './supplier-pipelines-http';
import {SupplierPipelinesError} from './supplier-pipelines-contract';
const id='11111111-1111-4111-8111-111111111111',stage='22222222-2222-4222-8222-222222222222';
function harness(){
 const calls:unknown[][]=[];
 const port:SupplierPipelinesHttpPort={
  acceptsMutationOrigin:request=>request.headers.get('origin')==='https://srm.example.invalid',
  read:async(...args)=>{calls.push(args);return Response.json({fixture:true},{headers:{'x-native-host':'fixture'}});},
  write:async(...args)=>{calls.push(args);return Response.json({fixture:true},{status:201});},
 };
 return {port,calls,handle:createSupplierPipelinesHttp(port)};
}
const get=(path:string)=>new Request('https://srm.example.invalid/api/adp/v1/'+path);
const post=(path:string,data:unknown,method='POST',headers:Record<string,string>={})=>new Request('https://srm.example.invalid/api/adp/v1/'+path,{
 method,headers:{'content-type':'application/json',origin:'https://srm.example.invalid',...headers},
 body:JSON.stringify({contractVersion:'1.0.0',idempotencyKey:'save_12345678',data}),
});
const gets=[
 ['suppliers?q=ABC&limit=100','supplier.catalog.read','SUPPLIERS'],
 ['suppliers/by-nip?nip=526-025-02-74','supplier.catalog.read','SUPPLIER_BY_NIP'],
 ['suppliers/'+id,'supplier.catalog.read','SUPPLIER_CARD'],
 ['suppliers/'+id+'/pipeline-history?cursor='+stage,'supplier.assignment.read','HISTORY'],
 ['suppliers/'+id+'/adp-status','supplier.adp-status.read','ADP_STATUS'],
 ['categories','supplier.category.read','CATEGORIES'],
 ['pipelines','supplier.pipeline.read','PIPELINES'],
 ['pipelines/'+id+'?limit=20','supplier.pipeline.read','PIPELINE'],
];
for(const [path,operation,kind]of gets)test('HTTP read '+path+' dispatches only the declared operation',async()=>{
 const h=harness(),request=get(path),response=await h.handle(request);
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(h.calls[0][0],request);assert.equal(h.calls[0][1],operation);assert.equal((h.calls[0][2] as {kind:string}).kind,kind);
});
test('HTTP never accepts tenant/user/operation overrides or ambiguous query fields',async()=>{
 for(const path of ['suppliers?organisationId='+id,'suppliers?operation=supplier.report.read','suppliers?limit=10000','suppliers?limit=1&limit=2','categories?supplierId='+id]){
  const h=harness();assert.equal((await h.handle(get(path))).status,422);assert.equal(h.calls.length,0);
 }
});
test('HTTP preserves the original request for native identity and uses server path identities',async()=>{
 const h=harness(),request=post('suppliers/'+id,{expectedVersion:0,displayName:'Nowa nazwa'},'PATCH');
 assert.equal((await h.handle(request)).status,201);assert.equal(h.calls[0][0],request);
 const command=h.calls[0][2] as {command:string;data:{supplierId:string}};
 assert.equal(command.command,'SUPPLIER_UPDATE');assert.equal(command.data.supplierId,id);
 const rejected=await h.handle(post('suppliers/'+id,{supplierId:stage,expectedVersion:1,displayName:'Inna'},'PATCH'));
 assert.equal(rejected.status,422);assert.equal(h.calls.length,1);
});
test('HTTP uses explicit mutation origin/peer verification and rejects privilege flags',async()=>{
 const h=harness();
 assert.equal((await h.handle(post('suppliers',{nip:'5260250274',displayName:'A'},'POST',{origin:'https://attacker.invalid'}))).status,403);
 assert.equal((await h.handle(post('suppliers',{nip:'5260250274',displayName:'A',organisationId:id}))).status,422);
 assert.equal(h.calls.length,0);
});
test('HTTP normalizes duplicate NIP input before authoritative native dispatch',async()=>{
 const h=harness();h.port.write=async(_r,_o,command)=>{h.calls.push([command]);throw new SupplierPipelinesError('DUPLICATE_NIP',undefined,{supplierId:id,displayName:'Istniejąca',lifecycle:'ACTIVE'});};
 const response=await h.handle(post('suppliers',{nip:'526-025-02-74',displayName:'  Inna pisownia '}));
 assert.equal(response.status,409);const body=await response.json();
 assert.equal(body.error.existingSupplier.supplierId,id);assert.equal(body.error.retryable,false);
 assert.equal((h.calls[0][0] as {data:{nip:string}}).data.nip,'5260250274');
});
test('HTTP stage movement retains CAS and the selected process semantics for drag and drop',async()=>{
 const h=harness(),response=await h.handle(post('memberships/'+id,{stageId:stage,expectedVersion:2,expectedPipelineVersion:3},'PATCH'));
 assert.equal(response.status,201);
 const command=h.calls[0][2] as {command:string;data:Record<string,unknown>};
 assert.equal(command.command,'MEMBERSHIP_MOVE');assert.equal(command.data.membershipId,id);assert.equal(command.data.expectedVersion,2);
 assert.equal(h.calls[0][1],'supplier.assignment.write');
});
test('HTTP occupied-stage removal requires target/count/version before native dispatch',async()=>{
 const h=harness(),path='pipelines/'+id+'/stages/'+stage+'/remove';
 assert.equal((await h.handle(post(path,{expectedPipelineVersion:1,expectedCount:4}))).status,422);
 assert.equal(h.calls.length,0);
});
test('HTTP bounds streamed bodies even without trusted Content-Length',async()=>{
 const h=harness(),request=post('categories',{name:'x'.repeat(131072)});
 assert.equal((await h.handle(request)).status,413);assert.equal(h.calls.length,0);
});
test('HTTP refuses mismatched wire version and masks unknown native/internal errors',async()=>{
 const h=harness();
 assert.equal((await h.handle(new Request(get('suppliers'),{headers:{'x-srm-contract-version':'2.0.0'}}))).status,409);
 h.port.read=async()=>{throw Error('postgresql://secret@internal/private SQL grant source')};
 const response=await h.handle(get('suppliers')),text=await response.text();
 assert.equal(response.status,503);assert.doesNotMatch(text,/secret|postgres|SQL grant/);
 assert.equal(JSON.parse(text).error.retryable,true);
});
test('HTTP cannot serialize an unprojected object returned outside the native disclosure host',async()=>{
 const h=harness();h.port.read=(async()=>({privatePayload:'must not escape'})) as never;
 const response=await h.handle(get('suppliers'));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/privatePayload/);
});
test('HTTP forwards native unauthenticated/foreign denials without disclosing existence',async()=>{
 const h=harness();h.port.read=async()=>new Response('{"error":{"code":"NOT_FOUND"}}',{status:404});
 const response=await h.handle(get('suppliers/'+id));assert.equal(response.status,404);assert.equal(response.headers.get('cache-control'),'no-store');
 h.port.read=async()=>new Response('{"error":{"code":"UNAUTHENTICATED"}}',{status:401});
 assert.equal((await h.handle(get('suppliers'))).status,401);
});
