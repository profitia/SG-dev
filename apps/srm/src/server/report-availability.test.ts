import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import { reportAvailability, FinancialScannerMount, type GeneralCompanyData, type SectionEnvelope, type FinancialData, type SupplierReportData } from "@profitia/srm-xray";
const general=(registrationStatus:GeneralCompanyData["registrationStatus"])=>({registrationStatus,deregisteredAt:"2009-01-19"}) as GeneralCompanyData;
const msr:SectionEnvelope<FinancialData>={status:"EMPTY",data:null,source:{provider:"MGBI",model:"pl-krs-rdf-record",recordId:null},retrievedAt:null,effectiveAt:null,warnings:["FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE"]};
test("legal status takes precedence; missing data and technical failures are not IAS verdicts",()=>{
 assert.equal(reportAvailability(general("DEREGISTERED"),msr).code,"DEREGISTERED");
 assert.equal(reportAvailability(general("LIQUIDATION"),msr).code,"LIQUIDATION");
 assert.equal(reportAvailability(general("ACTIVE"),msr).code,"UNSUPPORTED_IAS");
 for(const section of [null,{...msr,warnings:[]},{...msr,status:"ERROR" as const}])assert.equal(reportAvailability(general("ACTIVE"),section).code,"AVAILABLE");
 assert.equal(reportAvailability(general("ACTIVE"),msr).hideDetails,false);
});
for(const status of ["LIQUIDATION","DEREGISTERED","ACTIVE"] as const)test(`blocked scanner ${status} never reads stale financial projection and assistant repeats the same notice`,()=>{
 const availability=reportAvailability(general(status),msr);
 const stale={nip:"wrong-supplier",get financial(){throw Error("stale financial data was read")}} as unknown as SupplierReportData;
 const html=renderToStaticMarkup(React.createElement(FinancialScannerMount,{report:stale,availability,assistant:{nip:"6922200609",name:"Supplier",avatars:{male:"/male.png",anna:"/anna.png"}}}));
 assert.equal(html.split(availability.message).length-1,2);
 assert.match(html,/inert=""/);assert.match(html,/aria-hidden="true"/);
 assert.doesNotMatch(html,/wrong-supplier|Przychody wynoszą|Płynność bieżąca:|Napisz wiadomość|srm-radar-sector|srm-indicator-grid/);
 assert.match(html,/Supplier Finance Scanner/);
});
