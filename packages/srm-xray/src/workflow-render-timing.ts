import {useRef,useEffect} from 'react';
import {supplierNip,type ReportState} from './workflow-controller';
/** Original AppShell committed-view observer, retained through UI extraction. */
export function useWorkflowRenderTiming(state:ReportState,active:boolean){
 const reportTiming=useRef<{traceId:string;nip:string;startedAt:number;rendered:boolean}|null>(null);
 const result=state.result,selectedNip=supplierNip(result);
 const searchPending=!!result&&(result.entityType==='COMPANY'?result.card.financial.status==='PENDING':result.section.status==='PENDING');
 useEffect(()=>{
  if(!active||state.error||state.metadataError){reportTiming.current=null;return;}
  const timing=reportTiming.current;
  if(!timing||timing.rendered||!result||selectedNip!==timing.nip||state.busy||state.metadataBusy
    ||state.error||state.metadataError||!state.metadata||searchPending)return;
  if(typeof window==='undefined'||typeof window.requestAnimationFrame!=='function')return;
  const committedViewMs=performance.now();let second=0;
  const first=window.requestAnimationFrame(()=>{second=window.requestAnimationFrame(()=>{
   if(reportTiming.current!==timing)return;
   timing.rendered=true;
   // Observability contains no supplier data, credentials or access proof.
   // Completion follows the same committed view and current metadata as UI.
   try{console.info(JSON.stringify({event:'srm_workflow_client_rendered',schema:'srm.workflow-render-timing/1.0',
    traceId:timing.traceId,startMs:timing.startedAt,endMs:performance.now(),committedViewMs,
    entityType:result.entityType,generalStatus:result.entityType==='COMPANY'?result.card.general.status:result.section.status,
    financialStatus:result.entityType==='COMPANY'?result.card.financial.status:null,
    completeBasicReport:true,afterCommittedViewAndTwoAnimationFrames:true}));}catch{}
  });});
  return()=>{window.cancelAnimationFrame(first);window.cancelAnimationFrame(second);};
 },[active,result,selectedNip,searchPending,state.busy,state.metadataBusy,state.error,state.metadataError,state.metadata]);
 return (nip:string)=>{reportTiming.current=null;try{reportTiming.current={traceId:crypto.randomUUID(),nip,startedAt:performance.now(),rendered:false}}catch{}};
}
