import {randomUUID} from 'node:crypto';
import {getSrmReportRuntime} from '../../../../../src/server/private-runtime';
import {SupplierPipelinesError} from '../../../../../src/server/supplier-pipelines-contract';
import {supplierPipelinesErrorResponse} from '../../../../../src/server/supplier-pipelines-http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request):Promise<Response> {
 try{
  const selected=getSrmReportRuntime();
  if(selected.provider!=='clerk'||!selected.supplierPipelines)throw new SupplierPipelinesError('UNAVAILABLE');
  return await selected.supplierPipelines.handle(request);
 }catch{return supplierPipelinesErrorResponse(new SupplierPipelinesError('UNAVAILABLE'),randomUUID())}
}
export {handle as GET,handle as POST,handle as PATCH,handle as PUT,handle as DELETE};
