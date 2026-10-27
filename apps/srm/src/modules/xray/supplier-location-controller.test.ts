import assert from 'node:assert/strict'
import test from 'node:test'
import {SupplierLocationController} from './supplier-location-controller'
const supplier='11111111-1111-4111-8111-111111111111'
const page={supplierId:supplier,items:[],offset:0,limit:50,total:0,collectionVersion:'0',hasMore:false}
const command={label:'Budowa',description:'',address:{line1:'Prosta 1',postalCode:'00-001',locality:'Warszawa',country:'Polska'},position:null}
test('old supplier/session results are discarded even when the transport ignores abort',async()=>{
 let release!:(r:Response)=>void
 const controller=new SupplierLocationController(supplier,async()=>new Promise<Response>(resolve=>{release=resolve}))
 const pending=controller.load();controller.dispose();release(Response.json(page));await pending
 assert.equal(controller.getSnapshot().page,null);assert.equal(controller.getSnapshot().busy,false)
})
test('uncertain manual retry reuses a logical key; changed commands get a new key',async()=>{
 const keys:string[]=[],bodies:unknown[]=[];let count=0
 const controller=new SupplierLocationController(supplier,async(_url,init)=>{keys.push(new Headers(init?.headers).get('Idempotency-Key')!);bodies.push(JSON.parse(String(init?.body)));if(count++===0)throw Error('uncertain');return Response.json({status:'ACCEPTED'})},()=>String(count).padEnd(24,'x'))
 await assert.rejects(controller.save('CREATE',null,null,command));await controller.save('CREATE',null,null,command);await controller.save('CREATE',null,null,{...command,label:'Different'})
 assert.equal(keys[0],keys[1]);assert.notEqual(keys[1],keys[2]);assert.deepEqual(Object.keys(bodies[0] as object).sort(),['action','command','expectedVersion','locationId','supplierId'])
})
test('revocation clears loaded rows and freezes mutation until a new report context',async()=>{
 let revoked=false
 const controller=new SupplierLocationController(supplier,async()=>revoked?Response.json({error:'denied'},{status:403}):Response.json(page))
 await controller.load();assert(controller.getSnapshot().page);revoked=true;await controller.load();assert.equal(controller.getSnapshot().page,null);assert.equal(controller.getSnapshot().blocked,true)
 await assert.rejects(controller.save('CREATE',null,null,command),/dostępu/)
})
test('latest filter wins over a late previous-page response',async()=>{
 const resolvers:((r:Response)=>void)[]=[]
 const controller=new SupplierLocationController(supplier,async()=>new Promise<Response>(resolve=>resolvers.push(resolve)))
 const first=controller.load('SUPPLIER_LOCATIONS'),second=controller.load('USER_LOCATIONS',50)
 resolvers[1](Response.json({...page,offset:50,total:60}));await second;resolvers[0](Response.json(page));await first
 assert.equal(controller.getSnapshot().page?.offset,50)
})
test('a read-only member retains the map after denied automatic sync or manual write',async()=>{
 const actions:string[]=[]
 const controller=new SupplierLocationController(supplier,async(_url,init)=>{
  const input=JSON.parse(String(init?.body));actions.push(input.action)
  return input.action==='READ'?Response.json(page):Response.json({error:'denied'},{status:403})
 })
 await controller.sync();assert.equal(controller.getSnapshot().sync,'UNAVAILABLE');assert.equal(controller.getSnapshot().blocked,false)
 await controller.load();assert(controller.getSnapshot().page)
 await assert.rejects(controller.save('CREATE',null,null,command));assert.equal(controller.getSnapshot().page,null);assert.equal(controller.getSnapshot().blocked,false)
 await controller.load();assert(controller.getSnapshot().page)
 assert.deepEqual(actions,['SYNC','READ','READ','CREATE','READ','READ'])
})
test('a denied sync followed by current read revocation clears the map and blocks writes',async()=>{
 let revoked=false;const actions:string[]=[]
 const controller=new SupplierLocationController(supplier,async(_url,init)=>{actions.push(JSON.parse(String(init?.body)).action);return revoked?Response.json({error:'denied'},{status:403}):Response.json(page)})
 await controller.load();assert(controller.getSnapshot().page);revoked=true;await controller.sync()
 assert.equal(controller.getSnapshot().page,null);assert.equal(controller.getSnapshot().blocked,true)
 assert.deepEqual(actions,['READ','SYNC','READ']);await assert.rejects(controller.save('CREATE',null,null,command),/dostępu/)
})

test('identical protected polls retain the map projection without caching authorization',async()=>{
 let calls=0,version='0',failure=false
 const controller=new SupplierLocationController(supplier,async()=>{calls++;return failure?Response.json({error:'unavailable'},{status:503}):Response.json({...page,collectionVersion:version})})
 await controller.load();const first=controller.getSnapshot().page
 await controller.load();assert.equal(controller.getSnapshot().page,first);assert.equal(calls,2)
 version='1';await controller.load();assert.notEqual(controller.getSnapshot().page,first);assert.equal(controller.getSnapshot().page?.collectionVersion,'1');assert.equal(calls,3)
 failure=true;await controller.load();assert.equal(controller.getSnapshot().page,null);assert.equal(calls,4)
})

const addressOnly={id:'22222222-2222-4222-8222-222222222222',supplierId:supplier,version:'1',addressVersion:'address-1',label:'Fixture HQ',lifecycle:'ACTIVE',geocodingStatus:'UNREQUESTED',coordinates:null,address:command.address}
const viewCoordinates={position:{lat:52.2,lng:21.1},origin:'GOOGLE_GEOCODING',fetchedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve))
test('eligible address uses server-selected geocoding once and overlays only a fresh matching protected version',async()=>{
 let reads=0,calls=0;const bodies:Record<string,unknown>[]=[]
 const controller=new SupplierLocationController(supplier,async(_url,init)=>{
  const body=JSON.parse(String(init?.body));bodies.push(body)
  if(body.action==='GEOCODE'){calls++;return Response.json({status:'RESOLVED',transient:{locationId:addressOnly.id,addressVersion:'address-1',version:'2',coordinates:viewCoordinates}})}
  return Response.json({...page,total:1,geocodingAvailable:true,items:[{...addressOnly,version:reads++?'2':'1'}]})
 })
 await controller.load('SUPPLIER_LOCATIONS');for(let i=0;i<10&&controller.getSnapshot().page?.items[0].coordinates===null;i++)await tick()
 assert.equal(calls,1);assert.deepEqual(controller.getSnapshot().page?.items[0].coordinates?.position,viewCoordinates.position)
 assert.deepEqual(bodies.find(v=>v.action==='GEOCODE'),{action:'GEOCODE',supplierId:supplier,locationId:addressOnly.id})
 await controller.load('SUPPLIER_LOCATIONS');assert.equal(calls,1)
 const mapped=await controller.mapPage('SUPPLIER_LOCATIONS',0,new AbortController().signal);assert.deepEqual(mapped.items[0].coordinates?.position,viewCoordinates.position)
 controller.dispose();assert.equal(controller.getSnapshot().page,null)
})
test('no capability, incomplete address and uncertain provider delivery never produce a provider command',async()=>{
 for(const [geocodingAvailable,location]of[[false,addressOnly],[true,{...addressOnly,geocodingStatus:'DELIVERY_UNCERTAIN'}],[true,{...addressOnly,address:null}]]as const){
  const actions:string[]=[]
  const controller=new SupplierLocationController(supplier,async(_url,init)=>{actions.push(JSON.parse(String(init?.body)).action);return Response.json({...page,total:1,geocodingAvailable,items:[location]})})
  await controller.load();await tick();assert.deepEqual(actions,['READ'])
 }
})
test('revoked or changed protected state cannot display a paid result',async()=>{
 for(const mode of['revoked','changed']as const){let reads=0
  const controller=new SupplierLocationController(supplier,async(_url,init)=>{
   const body=JSON.parse(String(init?.body))
   if(body.action==='GEOCODE')return Response.json({status:'RESOLVED',transient:{locationId:addressOnly.id,addressVersion:'address-1',version:'2',coordinates:viewCoordinates}})
   if(reads++&&mode==='revoked')return Response.json({error:'denied'},{status:403})
   return Response.json({...page,total:1,geocodingAvailable:true,items:[{...addressOnly,version:reads===1?'1':'3'}]})
  })
  await controller.load();for(let i=0;i<10;i++)await tick()
  assert.equal(controller.getSnapshot().page?.items[0].coordinates??null,null)
  if(mode==='revoked')assert.equal(controller.getSnapshot().blocked,true)
 }
})
test('transient Google coordinates are discarded at expiry without another paid attempt or protected-read cache',async()=>{
 let reads=0,calls=0
 const controller=new SupplierLocationController(supplier,async(_url,init)=>{
  const body=JSON.parse(String(init?.body))
  if(body.action==='GEOCODE'){calls++;return Response.json({status:'RESOLVED',transient:{locationId:addressOnly.id,addressVersion:'address-1',version:'2',coordinates:{...viewCoordinates,expiresAt:new Date(Date.now()+200).toISOString()}}})}
  return Response.json({...page,total:1,geocodingAvailable:true,items:[{...addressOnly,version:reads++?'2':'1'}]})
 })
 await controller.load();for(let i=0;i<10&&!controller.getSnapshot().page?.items[0].coordinates;i++)await tick()
 assert(controller.getSnapshot().page?.items[0].coordinates)
 await new Promise(resolve=>setTimeout(resolve,250))
 assert.equal(controller.getSnapshot().page?.items[0].coordinates,null);assert.equal(calls,1)
 await controller.load();assert.equal(calls,1);controller.dispose()
})
test('a late headquarters geocode cannot replace the newly selected manual-locations page',async()=>{
 let release!:(r:Response)=>void;let latestGroup=''
 const controller=new SupplierLocationController(supplier,async(_url,init)=>{
  const body=JSON.parse(String(init?.body))
  if(body.action==='GEOCODE')return new Promise<Response>(resolve=>{release=resolve})
  latestGroup=body.group
  return Response.json(body.group==='USER_LOCATIONS'?page:{...page,total:1,geocodingAvailable:true,items:[addressOnly]})
 })
 await controller.load('SUPPLIER_LOCATIONS');await tick();await controller.load('USER_LOCATIONS')
 release(Response.json({status:'RESOLVED',transient:{locationId:addressOnly.id,addressVersion:'address-1',version:'2',coordinates:viewCoordinates}}))
 for(let i=0;i<10;i++)await tick()
 assert.equal(controller.getSnapshot().page?.total,0);assert.equal(latestGroup,'USER_LOCATIONS');controller.dispose()
})
