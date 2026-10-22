import type {SupplierCandidate, SupplierSelection, SupplierSearchGateway} from '@profitia/srm-xray';
function object(value:unknown,keys:string[]):Record<string,unknown>{
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!==[...keys].sort().join(','))throw Error('Nieprawidłowe dane katalogu.');
  return value as Record<string,unknown>;
}
function candidate(value:unknown):SupplierCandidate{
  const v=object(value,['krs','name','nip','locality']);
  if(typeof v.krs!=='string'||!/^\d{10}$/.test(v.krs)||typeof v.name!=='string'||!v.name.trim()||v.name.length>1000
    ||v.nip!==null&&(typeof v.nip!=='string'||!/^\d{10}$/.test(v.nip))
    ||v.locality!==null&&(typeof v.locality!=='string'||v.locality.length>300))throw Error('Nieprawidłowe dane katalogu.');
  return v as unknown as SupplierCandidate;
}
/** Only same-origin BFF URLs. No organisation, actor, provider or identity DTO comes from the browser. */
export function createSupplierSearchGateway(transport:typeof fetch=fetch):SupplierSearchGateway{
  async function call(path:string,body:unknown,signal:AbortSignal){
    const response=await transport('/api/xray/krs/'+path,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),cache:'no-store',signal});
    if(!response.ok)throw Error('Wyszukiwanie po nazwie jest obecnie niedostępne.');
    return response.json() as Promise<unknown>;
  }
  return Object.freeze({
    async available(signal){
      const response=await transport('/api/xray/krs/status',{cache:'no-store',signal});
      if(!response.ok)return false;
      return object(await response.json(),['enabled']).enabled===true;
    },
    async search(query,signal){
      const v=object(await call('search',{query},signal),['candidates','coverage']);
      if(v.coverage!=='PROGRESSIVE'||!Array.isArray(v.candidates)||v.candidates.length>10)throw Error('Nieprawidłowe dane katalogu.');
      const candidates=v.candidates.map(candidate);
      if(new Set(candidates.map(c=>c.krs)).size!==candidates.length)throw Error('Nieprawidłowe dane katalogu.');
      return {candidates,coverage:'PROGRESSIVE' as const};
    },
    async verify(krs,signal){
      const v=object(await call('verify',{krs},signal),['krs','name','nip','locality','selectionRef']);
      const {selectionRef,...facts}=v, selected=candidate(facts);
      if(selected.krs!==krs||selected.nip===null||typeof selectionRef!=='string'||!/^[A-Za-z0-9:_-]{16,256}$/.test(selectionRef))throw Error('Nie udało się potwierdzić danych spółki.');
      return {...selected,nip:selected.nip,selectionRef} satisfies SupplierSelection;
    },
  });
}
