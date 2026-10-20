import {createRuntimeSupplierOperationHandler} from '../../../../../src/server/supplier-acquisition-http';
import { kysPdfHandler } from "../../../../../src/server/kys-pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createRuntimeSupplierOperationHandler('pdf',kysPdfHandler());
