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
