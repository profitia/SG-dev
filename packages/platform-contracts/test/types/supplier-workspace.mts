import {createSupplierWorkspaceHost,type SupplierWorkspaceHostOptions} from '../../src/supplier-workspace-host.mjs';
import {createSupplierWorkspaceOperationHost,type SupplierWorkspaceOperationHostOptions} from '../../src/private-operation-host.mjs';
import type {OperationInput} from '../../src/operation-context.mjs';
declare const options:SupplierWorkspaceHostOptions<object>;
declare const native:SupplierWorkspaceOperationHostOptions<object>;
declare const input:OperationInput;
const h=createSupplierWorkspaceHost(options);h.execute(input);
createSupplierWorkspaceOperationHost(native).execute(input);
// @ts-expect-error A receiving consumer cannot execute arbitrary SQL callbacks.
h.execute(input,()=>({query:'SELECT 1'}));
// @ts-expect-error An unverified identity callback cannot replace the official provider.
createSupplierWorkspaceHost({...options,createAuthenticator:()=>async()=>null});
// @ts-expect-error Resource/tenant ownership cannot come from a consumer callback.
createSupplierWorkspaceHost({...options,readResources:async()=>({})});
// @ts-expect-error The final provider check cannot be replaced by a projector.
createSupplierWorkspaceHost({...options,projectOutput:(value:unknown)=>value});
// @ts-expect-error SQL/schema acceptance cannot be omitted.
const noBinding:SupplierWorkspaceHostOptions<object>={...options,supplierWorkspace:undefined};
void noBinding;
