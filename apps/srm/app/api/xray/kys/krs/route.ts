import { verclyKrsHandler } from "../../../../../src/server/vercly-krs";
import {createRuntimeSupplierOperationHandler} from '../../../../../src/server/supplier-acquisition-http';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createRuntimeSupplierOperationHandler('krs',verclyKrsHandler());
