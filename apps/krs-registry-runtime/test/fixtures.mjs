import {normalizeExtract} from '../dist/normalizer.js'
export const NOW=Date.parse('2026-10-22T13:00:00.000Z'),KRS='0000028860',NIP='7740001454',REGON='61018820100003'
export const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value))
export function extract({id=KRS,register='P',name='Łódź Test SPÓŁKA AKCYJNA',nip=NIP,regon=REGON,status=1,form='SPÓŁKA AKCYJNA',full=false}={}){
 const company={nazwa:name,formaPrawna:form,identyfikatory:{...(nip===null?{}:{nip}),...(regon===null?{}:{regon})}}
 const address={kraj:'POLSKA',miejscowosc:'ŁÓDŹ',kodPocztowy:'90-001',ulica:'DŁUGA',nrDomu:'7'}
 if(full){company.nazwa=[{nazwa:'DAWNA NAZWA',nrWpisuWprow:'1',nrWpisuWykr:'2'},{nazwa:name,nrWpisuWprow:'2'}];company.formaPrawna=[{formaPrawna:form,nrWpisuWprow:'1'}];company.identyfikatory=[{identyfikatory:{regon:REGON},nrWpisuWprow:'1',nrWpisuWykr:'2'},{identyfikatory:{nip:NIP,regon:REGON},nrWpisuWprow:'2'}]}
 return {odpis:{rodzaj:full?'Pełny':'Aktualny',[full?'naglowekP':'naglowekA']:{rejestr:'Rej'+register,numerKRS:id,dataCzasOdpisu:'22.10.2026 15:00:00',stanZDnia:'21.10.2026',dataRejestracjiWKRS:'19.07.2001',numerOstatniegoWpisu:3,stanPozycji:status,...(full?{wpis:[{numerWpisu:1,dataWpisu:'19.07.2001'},{numerWpisu:3,dataWpisu:'21.10.2026'}]}:{})},dane:{dzial1:{danePodmiotu:company,siedzibaIAdres:{adres:full?[{...address,nrWpisuWprow:'1'}]:address}},dzial6:{}}}}
}
export const snapshot=async(options={})=>normalizeExtract(bytes(extract(options)),{krs:options.id??KRS,register:options.register??'P',extract:options.full?'FULL':'CURRENT',retrievedAt:new Date(NOW).toISOString()})
export function memoryCatalog(p,s=null){let current=p;return {set(value){current=value},async read(id,register){if(id!==current?.canonicalKrs)return null;return register==='S'?s:current},async accepted(ref){return current?.evidenceRef===ref?current:null},async byNip(nip){return current?.nip===nip?[current.canonicalKrs]:[]}}}
/** Explicit offline transport fixture; never installed as an E1 binding or accepted Source receipt. */
export const fixtureSource=fn=>({execute:async(input,options)=>fn(input,options)})
