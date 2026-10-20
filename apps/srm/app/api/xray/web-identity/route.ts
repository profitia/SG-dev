import {createRuntimeSupplierOperationHandler} from '../../../../src/server/supplier-acquisition-http';
import { supplierWebIdentityHandler } from "../../../../src/server/supplier-web-identity";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST=createRuntimeSupplierOperationHandler('web',supplierWebIdentityHandler);
