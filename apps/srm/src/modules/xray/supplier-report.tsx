"use client";
import React, {useRef,useEffect} from 'react';
import {FullSupplierReport} from '@profitia/srm-xray/full-report';
import {observeReportResourceTiming} from './report-performance';
import targets from '../../../deployment/supplier-location-targets.json';
export {reportMessage,useSupplierReportContext,navigateReportSection} from '@profitia/srm-xray/full-report';
export type {SupplierReportContext,SupplierReportSlots} from '@profitia/srm-xray/full-report';
const loadMap=()=>import('@profitia/maps-embed').then(module=>module.mountMaps);
/** Standalone-only measurement adapter. Shared UI does not own host telemetry. */
export function SupplierReport(props:React.ComponentProps<typeof FullSupplierReport>){
  const {state}=props;
  const renderedBasicReport = useRef<string | null>(null);
  useEffect(() => {
    const timing=state.reportTiming;
    if(!timing||state.busy||state.metadataBusy||!state.result||!state.metadata||state.error||state.metadataError
      ||renderedBasicReport.current===timing.traceId)return;
    let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
      renderedBasicReport.current=timing.traceId;
      const renderedAt=performance.now();
      console.info(JSON.stringify({event:'srm_diagnostic_client_rendered',schema:'srm.diagnostic-trace/1.0',
        traceId:timing.traceId,lastFragmentId:timing.lastFragmentId,clock:'BROWSER_PERFORMANCE_NOW_NOT_SERVER_CLOCK',
        startMs:timing.startedAt,endMs:renderedAt,controllerCompleteMs:timing.controllerCompleteMs,
        network:observeReportResourceTiming(timing.startedAt,timing.controllerCompleteMs,renderedAt),
        completeBasicReport:true,afterCommittedViewAndTwoAnimationFrames:true}));
    })});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)};
  },[state.reportTiming,state.busy,state.metadataBusy,state.result,state.metadata,state.error,state.metadataError]);
  const renderedKysRequest = useRef<string | null>(null);
  useEffect(() => {
    const timing = state.kysTiming;
    if (!timing || state.kysBusy || state.metadataBusy || renderedKysRequest.current === timing.requestId) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      renderedKysRequest.current = timing.requestId;
      const totalMs = performance.now() - timing.startedAt;
      // After the committed report and two animation frames: includes the browser's paint opportunity.
      console.info(JSON.stringify({ event: "srm_kys_render_timing", requestId: timing.requestId, mode: timing.mode, outcome: state.kys.status, apiMs: timing.apiMs, totalMs, afterApiMs: totalMs - timing.apiMs, serverTiming: timing.serverTiming }));
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [state.kysTiming, state.kysBusy, state.metadataBusy, state.kys.status]);
  return <FullSupplierReport {...props} mapRuntimeOrigin={targets.mapsRuntimeOrigin} loadMap={loadMap} />;
}
