import {createHash} from 'node:crypto'
import type {OilEvidenceBundle} from './oil-report-evidence'
import type {OilNarrative} from './oil-report-contract'
import {validateOilNarrative,validateOilRenderedBody} from './oil-report-validation'
const fmt=(v:number|null)=>v===null?'NOT_AVAILABLE':v.toFixed(2).replace('.',',')
const names={naive:'Naive',damped_holt:'Damped Holt',ets:'ETS',arima:'ARIMA'}
/** Plain-text canonical visible serialization. Markdown/PDF/graph renderers may
 * not silently exclude their labels/tables from this same character budget. */
export function renderOilReport(raw:OilNarrative,bundle:OilEvidenceBundle){
 const n=validateOilNarrative(raw,bundle),f=bundle.forecast
 const para=(key:keyof OilNarrative)=>n[key].map(s=>s.text.normalize('NFC')).join(' ')
 const rows=f.series.map(s=>s.name+' '+fmt(s.actual)+' | '+s.models.map(m=>names[m.id]+': '+fmt(m.point)+' (Δ '+fmt(m.delta)+' USD; '+fmt(m.deltaPercent)+'%)').join('; '))
 const verification=f.series.map(s=>s.name+': '+s.models.map(m=>names[m.id]+' '+fmt(m.smape)+'% / '+fmt(m.historicalAverageVerificationPercent)+'% / '+fmt(m.directionalAccuracyPercent)+'%').join('; '))
 const matured=f.series.map(s=>s.name+': '+s.models.map(m=>names[m.id]+' '+fmt(m.lastMatured.predicted)+'/'+fmt(m.lastMatured.actual)).join('; '))
 const body=[
  'Oil Market Outlook — Brent & WTI',
  'Stan: '+bundle.asOf+'; wewnętrzny pilot.',
  '1. Analiza statystyczna',
  'Futures, USD/bbl. Obserwacja '+f.origin+'; prognoza na '+f.target+' (7 dni od obserwacji, nie od publikacji).',
  'Benchmark: aktualna cena | prognozy',...rows,
  'Zmiana faktycznej ceny od 23.10: '+f.series.map(s=>s.name+' '+fmt(s.weekChange)+' USD ('+fmt(s.weekChangePercent)+'%)').join('; ')+'.',
  'Weryfikacja: sMAPE / 100−sMAPE / trafność kierunku',...verification,
  'Ostatnia dojrzała D7: prognoza/rzeczywista, USD/bbl',...matured,
  '40 dojrzałych porównań na model i serię; łącznie '+f.comparisonCount+'. Ostatnia dojrzała prognoza: 23.10 → 30.10. Miara 100−sMAPE nie jest prawdopodobieństwem; Naive zakłada brak ruchu.',
  para('statistical'),
  '2. Kalendarium rynkowe',para('calendar'),
  ...(bundle.market.some(e=>e.verification==='INDEPENDENTLY_VERIFIED')?[]:['Brak zweryfikowanych publikacji i kalendarium w tym pakiecie przygotowawczym. Nie oznacza to braku wydarzeń.']),
  '3. Realna gospodarka',para('economy'),
  '4. Procurement Insights',para('procurement'),
  'Kategoria: asfalt drogowy; region i ekspozycja nieokreślone. Futures nie są ceną asfaltu ani ofertą dostawcy.',
  'EXPERIMENTAL_7D / PARTIAL_READY. Przedziały: NOT_AVAILABLE. Rollover i kalendarz sesji niezweryfikowane. Latest-vintage, bez certyfikacji point-in-time. Wymagana ocena człowieka.'
 ].join('\n').normalize('NFC')
 const validation=validateOilRenderedBody(body)
 return {body,...validation,bodySha256:createHash('sha256').update(body).digest('hex'),metadata:{schemaVersion:'OilReportLineage/1',evidenceFingerprint:bundle.fingerprint,rawOutputManuallyEdited:false,refs:n,chartStatus:'ENDPOINTS_ONLY_NO_INVENTED_FORECAST_PATH',bibliography:bundle.market,forecastInputSha256:f.inputSha256}}
}
