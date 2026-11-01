/** Narrow same-origin BFF transport. SDK credentials are acquired per operation;
 * no browser tenant claim authorizes a resource. */
export function pciFailureMessage(status:number,body:unknown,locale:'pl'|'en'){
  const t=(pl:string,en:string)=>locale==='pl'?pl:en
  if(status===400){
    const messages:Record<string,string>={
      PURCHASE_DATE_INVALID:t('Podaj pełną, prawidłową datę zakupu.','Enter a complete, valid purchase date.'),
      PURCHASE_DETAILS_INVALID:t('Wróć do kroku 02. Sprawdź dodatnią cenę, trzyliterową walutę, jednostkę oraz warunki zakupu.','Return to step 02. Check the positive price, three-letter currency, unit and purchase terms.'),
      SOURCE_METHOD_INVALID:t('Sprawdź znaczenie obserwacji i metodę wskazanego komponentu. Jeśli znaczenie jest nieustalone, pozostaw je bez wyboru.','Check the indicated component’s observation meaning and method. Leave an undetermined meaning unselected.'),
      CATEGORY_INPUT_INVALID:t('Wróć do kroku 01. Sprawdź nazwy, przypisane benchmarki i całkowite udziały komponentów.','Return to step 01. Check names, assigned benchmarks and whole-number component weights.'),
      REFERENCE_INPUT_INVALID:t('Sprawdź dostępne okresy ponownie i wybierz aktualne odniesienie.','Check available periods again and select a current reference.'),
      REFERENCE_YEAR_INVALID:t('Wybierz starszy rok z listy dostępnych lat.','Choose an older year from the available list.'),
    }
    const issues=body&&typeof body==='object'&&'code' in body&&body.code==='PCI_INPUT_INVALID'&&'issues' in body&&Array.isArray(body.issues)?body.issues.slice(0,8):[]
    const details=issues.flatMap(i=>{
      if(!i||typeof i!=='object'||typeof i.code!=='string'||!Object.hasOwn(messages,i.code))return[]
      const component=Number.isInteger(i.componentIndex)&&i.componentIndex>=0&&i.componentIndex<12?t(`Komponent ${i.componentIndex+1}: `,`Component ${i.componentIndex+1}: `):''
      return [component+messages[i.code]]
    })
    return [...new Set(details)].join(' ')||t('Żądanie zawiera nieprawidłowe dane. Sprawdź pola formularza; samo ponawianie nie poprawi danych.','The request contains invalid input. Check the form fields; retrying alone will not correct it.')
  }
  if(status===429)return t('Przekroczono limit sprawdzania. Poczekaj i ponów sprawdzenie.','The request limit was reached. Wait and retry.')
  return t('Źródło jest chwilowo niedostępne. Ponów sprawdzenie po odzyskaniu połączenia.','The source is temporarily unavailable. Retry when the connection is restored.')
}

export function createPciRequester(options:{getToken:()=>Promise<string|null>;fetch:typeof fetch}){
  let closed=false;const pending=new Set<AbortController>()
  const request=async(body:string,signal?:AbortSignal)=>{
    if(closed)throw Error('SESSION_UNAVAILABLE')
    const controller=new AbortController();pending.add(controller)
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort()
    try{
      const token=await options.getToken()
      if(closed||controller.signal.aborted)throw new DOMException('Aborted','AbortError')
      if(!token||token.length>8192||! /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('SESSION_UNAVAILABLE')
      const response=await options.fetch('/api/cost-analysis/price-change-index',{method:'POST',body,
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal})
      if(closed||controller.signal.aborted){await response.body?.cancel();throw new DOMException('Aborted','AbortError')}
      return response
    }finally{signal?.removeEventListener('abort',abort);pending.delete(controller)}
  }
  return Object.assign(request,{close(){closed=true;for(const c of pending)c.abort();pending.clear()}})
}
