import {createSupplierSearchGateway as createGateway} from '@profitia/srm-xray/supplier-search-gateway';
import {prepareReport} from './krs-session-transport';
/** The standalone host retains its accepted form-admission adapter. */
export function createSupplierSearchGateway(transport:typeof fetch=fetch){return createGateway(transport,(nip,signal)=>prepareReport(transport,nip,signal))}
