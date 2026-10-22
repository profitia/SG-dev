import type {SelectedKrsIdentityEvidenceV1,IdentitySourceV1,CompanySnapshot} from '../src/index.js'
declare const evidence:SelectedKrsIdentityEvidenceV1
if(evidence.status==='VERIFIED'){
  const nip:string=evidence.identity.nip
  const ttl:300=evidence.validity.maxAgeSeconds
  // @ts-expect-error A public evidence DTO never contains organisation authority.
  evidence.organisationId
  // @ts-expect-error A verified identity has a non-null NIP.
  const absent:null=evidence.identity.nip
  void nip;void ttl;void absent
}else{
  const identity:null=evidence.identity
  // @ts-expect-error BLOCKED cannot carry verified Source authority.
  evidence.source
  void identity
}
// @ts-expect-error A different provider is not KRS source evidence.
const wrong:IdentitySourceV1={provider:'MGBI'}
declare const snapshot:CompanySnapshot
const provider:'KRS'=snapshot.source.provider
void wrong;void provider
