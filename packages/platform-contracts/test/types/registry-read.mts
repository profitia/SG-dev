import {registryReadResource,registryReadSelection,type OperationId,type RegistryReadOperation} from '../../src/operation-context.mjs'
const op:OperationId='supplier.registry.search'
const selected:RegistryReadOperation='supplier.registry.resolve'
void op;void selected
registryReadSelection('supplier.registry.search',{query:'Firma',limit:10,cursor:null})
registryReadResource('supplier.registry.read',{selectedKrs:'0000000001'},{environment:'development',generation:'1',snapshotRef:'ref'})
// @ts-expect-error A registry read is not a new paid request operation.
const paid:RegistryReadOperation='supplier.registry.refresh'
void paid
// @ts-expect-error Unknown operation IDs cannot widen the existing interpreter.
registryReadSelection('knowledge.discovery',{query:'Firma'})
// @ts-expect-error A browser-supplied owner is not part of the data-only observation.
registryReadResource('supplier.registry.read',{selectedKrs:'0000000001'},{environment:'development',generation:'1',snapshotRef:'ref',organisationId:'forged'})
