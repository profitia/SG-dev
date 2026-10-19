import assert from 'node:assert/strict'
import test from 'node:test'
import {isOperationDenied,operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {readSupplierPrivateTarget,readSupplierPrivateAcquisition,privateSupplierRequestResourceId,supplierRequestTarget,supplierRequestResourceId,readSupplierRequest} from './supplier-request-operation'
const command=readSupplierRequest({kind:'SUPPLIER_REPORT',nip:'8650004194'})
const targets=[{entityType:'COMPANY',section:'kys'},{entityType:'JDG',section:'kys'},{entityType:'JDG',section:'jdg'}] as const

test('server private target binds section and entity separately from the unchanged public NIP command',()=>{
 const ids=new Set<string>()
 for(const target of targets){
  const id=privateSupplierRequestResourceId(command,target);ids.add(id)
  assert.equal(id,`supplier-private-request:${target.entityType}:${target.section}:${operationPayloadDigest(command)}`)
  assert.deepEqual(supplierRequestTarget(id,command),{operation:'supplier.private.refresh',...target})
  assert(Object.isFrozen(readSupplierPrivateTarget(target)))
 }
 assert.equal(ids.size,3)
 assert.deepEqual(supplierRequestTarget(supplierRequestResourceId(command),command),{operation:'supplier.report.refresh'})
 assert.deepEqual(command,{kind:'SUPPLIER_REPORT',nip:'8650004194'})
})
test('private target refuses extra identity authority, getters, symbols, prototypes and invalid combinations',()=>{
 const target=targets[0],getter=Object.defineProperty({section:'kys'},'entityType',{enumerable:true,get(){throw Error('Getter must never run')}})
 const symbol={...target,[Symbol('actor')]:1}
 const hidden=Object.defineProperty({...target},'userId',{value:'forged'})
 for(const value of[null,[],{...target,entityType:'OTHER'},{...target,entityType:'COMPANY',section:'jdg'},
  {...target,section:'financial'},{...target,userId:'forged'},{...target,organisationId:'forged'},getter,symbol,hidden,
  {...target,entityType:{toString:()=> 'COMPANY'}},Object.assign(Object.create(null),target)])
  assert.throws(()=>readSupplierPrivateTarget(value),isOperationDenied)
})
test('private resource cannot change operation, digest, section or entity through a forged resource name',()=>{
 const good=privateSupplierRequestResourceId(command,targets[0])
 for(const id of[good+'x',good.replace('COMPANY:kys','COMPANY:jdg'),good.replace(/.$/,'f'),
  'supplier-private-request:COMPANY:kys:'+'0'.repeat(64),'supplier-private-request:COMPANY:financial:'+operationPayloadDigest(command),
  'supplier-request:'+operationPayloadDigest({kind:'SUPPLIER_REPORT',nip:'5260250274'})])
  assert.throws(()=>supplierRequestTarget(id,command),isOperationDenied)
 assert.throws(()=>supplierRequestTarget(good,readSupplierRequest({kind:'SUPPLIER_REPORT',nip:'5260250274'})),isOperationDenied)
})
test('optional private acquisition requires exact immutable installation and closed target metadata',()=>{
 const input={...targets[0],boundaryDigest:'a'.repeat(64)},captured=readSupplierPrivateAcquisition(input)
 input.boundaryDigest='b'.repeat(64);assert.equal(captured.boundaryDigest,'a'.repeat(64));assert(Object.isFrozen(captured))
 for(const value of[{...input,boundaryDigest:''},{...input,boundaryDigest:'A'.repeat(64)},{...input,operation:'supplier.report.refresh'},targets[0]])
  assert.throws(()=>readSupplierPrivateAcquisition(value),isOperationDenied)
})
