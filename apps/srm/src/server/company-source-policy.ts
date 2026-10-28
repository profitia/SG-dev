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

/** Confirmed provider absence is a neutral result, never a company publication.
 * Errors, incomplete evidence and financial-only work do not qualify. */
export function isEmptyMgbiCompany(general:SharedCompany['general'],financial:SharedCompany['financial']):boolean {
  return [general,financial].every((section,index)=>section.status==='EMPTY'&&section.data===null
    &&section.source.provider==='MGBI'&&section.source.model===(index===0?'pl-krs-wp-record':'pl-krs-rdf-record')
    &&section.source.recordId===null&&section.effectiveAt===null
    &&section.warnings.length===1&&section.warnings[0]===(index===0?'MGBI_NO_RECORD':'MGBI_NO_STRUCTURED_FINANCIAL_DATA')
    &&typeof section.retrievedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(section.retrievedAt)
    &&Number.isFinite(Date.parse(section.retrievedAt))
    &&new Date(section.retrievedAt).toISOString().slice(0,10)===section.retrievedAt.slice(0,10))
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
