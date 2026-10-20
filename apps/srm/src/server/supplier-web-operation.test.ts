import assert from 'node:assert/strict'
import test from 'node:test'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {readPrivateWebSelection,privateWebResourceId,readWebIdentityProjection} from './supplier-web-operation'
import {readSupplierPrivateAcquisition,privateSupplierRequestResourceId,supplierRequestTarget} from './supplier-request-operation'

const nip='8650004194',command={kind:'SUPPLIER_REPORT' as const,nip}
const page=()=>({status:'FOUND' as const,websiteUrl:'https://example.com/',evidenceUrl:'https://example.com/contact',
 logoDataUrl:null,logoSourceUrl:null,method:'WEBSITE_IDENTITY' as const,checkedAt:new Date().toISOString()})
test('website target binds the same public NIP command to its own private entity and optional installation',()=>{
 for(const entityType of ['COMPANY','JDG'] as const){
  const target={entityType,section:'web' as const,boundaryDigest:'a'.repeat(64),webBoundaryDigest:'b'.repeat(64)}
  assert.deepEqual(readSupplierPrivateAcquisition(target),target)
  assert.deepEqual(supplierRequestTarget(privateSupplierRequestResourceId(command,{entityType,section:'web'}),command),{operation:'supplier.private.refresh',entityType,section:'web'})
  assert.equal(privateWebResourceId(nip,entityType),`supplier-private-web:${entityType}:${nip}`)
 }
 for(const target of [{entityType:'COMPANY',section:'web',boundaryDigest:'a'.repeat(64)},
  {entityType:'COMPANY',section:'kys',boundaryDigest:'a'.repeat(64),webBoundaryDigest:'b'.repeat(64)},
  {entityType:'JDG',section:'web',boundaryDigest:'a'.repeat(64),webBoundaryDigest:'0'},
  {entityType:'COMPANY',section:'web',boundaryDigest:'a'.repeat(64),webBoundaryDigest:'b'.repeat(64),userId:'forged'}])
  assert.throws(()=>readSupplierPrivateAcquisition(target),isOperationDenied)
})
test('private website selector accepts only NIP and entity, never identity or organization authority',()=>{
 assert.deepEqual(readPrivateWebSelection({nip,entityType:'COMPANY'}),{nip,entityType:'COMPANY'})
 for(const value of [{nip,entityType:'COMPANY',organisationId:'forged'},{nip,entityType:'JDG',userId:'forged'},
  {nip:'0000000000',entityType:'COMPANY'},{nip,entityType:'OTHER'},
  Object.defineProperty({nip},'entityType',{enumerable:true,get(){assert.fail('Getter must not run')}})])
  assert.throws(()=>readPrivateWebSelection(value),isOperationDenied)
})
test('website projection preserves original evidence while refusing unclassified fields, unsafe links and executable logos',()=>{
 const input=page(),captured=readWebIdentityProjection(input);input.websiteUrl='https://changed.example/'
 assert.equal(captured.websiteUrl,'https://example.com/')
 for(const value of [{...page(),privateName:'private'}, {...page(),websiteUrl:'javascript:alert(1)'},
  {...page(),evidenceUrl:'http://169.254.169.254/'},{...page(),logoDataUrl:'data:image/svg+xml,<svg onload="x"/>'},
  {...page(),logoSourceUrl:'https://user:password@example.com/'},{...page(),status:'NOT_FOUND'},
  {...page(),method:'CLAIMED_BY_BROWSER'},{...page(),checkedAt:new Date(Date.now()+60000).toISOString()}])
  assert.throws(()=>readWebIdentityProjection(value))
 const absent={...page(),status:'NOT_FOUND',websiteUrl:null,evidenceUrl:null,method:null}
 assert.deepEqual(readWebIdentityProjection(absent),absent)
})
