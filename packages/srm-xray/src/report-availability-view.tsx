"use client";
import React from "react";
import { CanonElement } from "./ui-canon";
import type { ReportAvailability } from "./report-availability";
/** SRM-C61 / SRM-B40. Neutral skeleton only: no hidden supplier values or controls. */
export function ReportAvailabilityView({availability}: {availability: ReportAvailability}) {
  return <CanonElement as="section" canonId="SRM-C61" usage="report-availability:scanner" className="srm-report-unavailable" data-availability={availability.code} aria-label="Dostępność analizy finansowej">
    <div className="srm-availability-skeleton" aria-hidden="true" ref={node=>{if(node)node.inert=true}}>
      <div className="srm-availability-controls"><i /><i /><i /></div>
      <div className="srm-availability-radar" /><div className="srm-availability-line" />
    </div>
    <div className="srm-availability-notice" role="status"><h3>{availability.title}</h3><p>{availability.message}</p></div>
  </CanonElement>;
}
