import {createSrmSupplierOperationHandler} from './supplier-acquisition-http';
import {getSrmReportRuntime} from './private-runtime';
import {createRuntimeSrmFinancialExcelHandler} from './financial-excel-runtime';
import {createKrsNameHttpHandler} from './krs-name-runtime';
import {createSupplierLocationHandler} from './supplier-locations';
import {createSupplierMapReadinessHandler} from './supplier-map-readiness';
import {withSrmPresentationPeer} from './peer-xray-presentation';
const unavailable=async()=>Response.json({error:'XRAY_UNAVAILABLE'},{status:503});
/** No financial engine, provider routing, account resolver or data store lives
 * here. These are adapters to existing SRM operations only. */
export const handleXRayPresentation=withSrmPresentationPeer(async(request,operation)=>{
 if(operation==='financialExcel')return createRuntimeSrmFinancialExcelHandler(getSrmReportRuntime,unavailable)(request);
 if(operation==='registryStatus'||operation==='registrySearch'||operation==='registryVerify')return createKrsNameHttpHandler(operation==='registryStatus'?'status':operation==='registrySearch'?'search':'verify')(request);
 const runtime=getSrmReportRuntime();
 if(runtime.provider!=='clerk')return unavailable();
 if(operation==='locations')return runtime.locations?createSupplierLocationHandler(runtime.locations,runtime.defaultOrganisationId,runtime.locationGeocoding)(request):unavailable();
 if(operation==='mapReadiness'){
  if(!runtime.locations)return unavailable();
  const {supplierId}=await request.clone().json() as {supplierId:string},locations=runtime.locations;
  // The auxiliary GET carries no authority. Authorization uses the original
  // verified peer request, never a reconstructed identity or copied proof.
  return createSupplierMapReadinessHandler({read:async(_probe,id)=>{await locations.page({request,organisationId:runtime.defaultOrganisationId,supplierId:id},'SUPPLIER_LOCATIONS',0,1)}})
   (new Request('https://srm-development-runtime.onrender.com/api/supplier-locations?supplierId='+supplierId,{signal:request.signal}));
 }
 if(!runtime.supplierApi)return unavailable();
 const route=operation==='kysPdf'?'pdf':operation==='krsPdf'?'krs':operation==='revealPesel'?'reveal':'web';
 const run=()=>createSrmSupplierOperationHandler(route,runtime.supplierApi!,runtime.defaultOrganisationId)(request);
 return runtime.reportAdmission?runtime.reportAdmission.run(request,run):run();
});
