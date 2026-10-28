import targets from '../../deployment/supplier-native-targets.json'
import {IdentityConfigurationUnavailable} from './identity-runtime'
import type {SharedCompany} from './shared-catalog'
import {COMPANY_IDENTITY_VERSION} from './company-continuity'

export type CompanySourcePolicy = 'MGBI_ONLY'

/** Deployment-owned company policy. The independent pilots retain their own
 * configuration; neither a browser nor a cached report can select a provider. */
export function readCompanySourcePolicy(env:Readonly<Record<string,string|undefined>>):CompanySourcePolicy|undefined {
  if(env.RENDER_SERVICE_ID!==targets.serviceId)return undefined
  if(typeof window!=='undefined'
    ||['SRM_KRS_NIP_ENABLED','SRM_KRS_NAME_SEARCH_ENABLED','SRM_DEVELOPMENT_PILOT2_LOOKUP'].some(key=>env[key]!==undefined&&env[key]!=='false')
    ||env.SRM_PILOT2_REGISTRY_PROVIDER!==undefined)throw new IdentityConfigurationUnavailable()
  return 'MGBI_ONLY'
}

/** Historical reports remain readable. A fresh company acquisition may reuse
 * only evidence from its selected provider, never relabel KRS as MGBI. */
export function mgbiCompanyCache(value:SharedCompany|null):SharedCompany|null {
  return value?.general.source.provider==='MGBI'&&value.financial.source.provider==='MGBI'?value:null
}

/** Routing proof only, after the existing scoped freshness/mapping read.
 * A placeholder, another provider or incomplete identity cannot skip CEIDG. */
export function isKnownMgbiCompany(value:SharedCompany|null,nip:string):boolean {
  const cached=mgbiCompanyCache(value),general=cached?.general,data=general?.data,history=data?.registryHistory
  return !!data && (general?.status==='SUCCESS'||general?.status==='PARTIAL')
    && data.nip===nip && typeof data.legalName==='string' && !!data.legalName.trim()
    && typeof data.krs==='string' && /^\d{10}$/.test(data.krs)
    && history?.version===COMPANY_IDENTITY_VERSION && history.currentKrs===data.krs
    && Array.isArray(history.members) && history.members.filter(member=>member.krs===data.krs).length===1
}
