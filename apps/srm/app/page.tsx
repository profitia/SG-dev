"use client";
import {useMemo} from 'react';
import {CanonButton} from '@profitia/srm-xray';
import {FullXRayWorkflow} from '@profitia/srm-xray/full-workflow';
import {createSupplierSearchGateway} from '../src/modules/xray/supplier-search-gateway';
import {SupplierReport} from '../src/modules/xray/supplier-report';
import {SrmAuthenticatedView,SrmLogout,SrmSessionActions,useSrmSessionTransport} from './session-boundary';
import targets from '../deployment/supplier-location-targets.json';
export default function Home(){return <SrmAuthenticatedView><StandaloneXRay/></SrmAuthenticatedView>}
function StandaloneXRay(){
  const transport=useSrmSessionTransport();
  const gateway=useMemo(()=>createSupplierSearchGateway(transport),[transport]);
  return <FullXRayWorkflow transport={transport} searchGateway={gateway} ReportComponent={SupplierReport} mapRuntimeOrigin={targets.mapsRuntimeOrigin}
    assistantAvatars={{male:'/spendguru/assistant-male.png',anna:'/spendguru/assistant-female.png'}}
    sessionActions={(controls,entry,inactive)=><SrmSessionActions legacyVisible={!entry}><div className="appshield-actions">{controls}<SrmLogout legacyVisible={!inactive}><CanonButton canonId="SRM-C02" usage="page:05" type="submit" className="appshield-new-report">Wyloguj się</CanonButton></SrmLogout></div></SrmSessionActions>}/>;
}
