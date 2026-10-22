import type {CompanySnapshot,VerifiedIdentityV1} from '@profitia/krs-registry-contracts';
import type {GeneralCompanyData,SectionEnvelope} from '@profitia/srm-xray';

/** Person-free registry projection. It never writes a Supplier Location or impersonates MGBI. */
export async function krsGeneral(snapshot:CompanySnapshot,identity:VerifiedIdentityV1,now:number):Promise<SectionEnvelope<GeneralCompanyData>>{
  const {validateCompanySnapshot,validateIdentityEvidence}=await import('@profitia/krs-registry-contracts');
  const s=await validateCompanySnapshot(snapshot),v=await validateIdentityEvidence(identity,now);
  if(v.status!=='VERIFIED'||s.evidenceRef!==v.evidenceRef||s.canonicalKrs!==v.selectedKrs||s.nip!==v.identity.nip
    ||s.regon!==v.identity.regon||s.officialName!==v.identity.officialName||s.source.extract!=='CURRENT'
    ||s.source.rawDigest!==v.source.rawDigest||s.source.contentDigest!==v.source.contentDigest
    ||s.source.sourceVersion!==v.source.sourceVersion||s.source.retrievedAt!==v.source.retrievedAt)throw Error('KRS_IDENTITY_MISMATCH');
  const address=s.address;
  const registeredAddress=address?[address.street,[address.building,address.unit].filter(Boolean).join('/'),[address.postalCode,address.city].filter(Boolean).join(' '),address.country].filter(Boolean).join(', ')||null:null;
  return {status:s.state==='UNKNOWN'?'PARTIAL':'SUCCESS',source:{provider:'KRS',model:'OdpisAktualny',recordId:s.evidenceRef},
    retrievedAt:s.source.retrievedAt,effectiveAt:s.source.sourceAsOfDate,warnings:s.warnings,
    data:{legalName:s.officialName,legalForm:s.legalForm,krs:s.canonicalKrs,nip:s.nip,regon:s.regon,
      registeredAddress,registeredAt:s.registeredOn,mainPkd:null,
      registrationStatus:s.state==='ACTIVE'?'ACTIVE':s.state==='REMOVED'?'DEREGISTERED':'UNKNOWN',deregisteredAt:s.removedOn,
      registrySource:{provider:'KRS',evidenceRef:s.evidenceRef,retrievedAt:s.source.retrievedAt,coverage:'PROGRESSIVE'}}};
}
