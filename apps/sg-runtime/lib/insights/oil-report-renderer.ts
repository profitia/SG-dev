import {createHash} from 'node:crypto'
import type {OilEvidenceBundle} from './oil-report-evidence'
import type {OilNarrative} from './oil-report-contract'
import {validateOilNarrative,validateOilRenderedBody} from './oil-report-validation'
const fmt=(v:number|null|undefined)=>v==null?'NOT_AVAILABLE':v.toFixed(2).replace('.',',')
const names={naive:'Naive',damped_holt:'Damped Holt',ets:'ETS',arima:'ARIMA'}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
/** Categorical points, not an interpolated forecast trajectory. Every SVG text
 * node has an identical entry in the visible character serialization. */
function chart(s:OilEvidenceBundle['forecast']['series'][number]){
 const points=[{label:'23.10',value:s.previousWeekValue},{label:'30.10',value:s.actual},...s.models.map(m=>({label:names[m.id]+' 06.11',value:m.point}))]
 const labels=[s.name+' — D7 06.11.2026','USD/bbl',...points.map(p=>p.label+' '+fmt(p.value)),'EXPERIMENTAL_7D / PARTIAL_READY; przedziały NOT_AVAILABLE']
 const values=points.map(p=>p.value),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||1
 const text=(x:number,y:number,t:string)=>'<text x="'+x+'" y="'+y+'">'+escape(t)+'</text>'
 const rows=points.map((p,i)=>text(16,78+i*35,labels[i+2])+'<circle cx="'+(350+(p.value-lo)/span*190).toFixed(2)+'" cy="'+(73+i*35)+'" r="5" fill="'+(i<2?'#14243b':'#326ac1')+'"/>').join('')
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="620" height="330" viewBox="0 0 620 330"><rect width="620" height="330" fill="#f7f9fc"/><g fill="#14243b" font-family="Arial,sans-serif" font-size="14">'+text(16,25,labels[0])+text(350,47,labels[1])+rows+text(16,315,labels.at(-1)!)+'</g></svg>'
 return {name:s.name==='WTI'?'WTI_D7.svg':'BRENT_D7.svg',svg,visibleText:labels.join('\n'),sha256:hash(svg),points}
}
/** One canonical renderer. All SVG text replaces its image marker for counting;
 * headings/table punctuation count conservatively, never omitting a label. */
export function renderOilReport(raw:OilNarrative,bundle:OilEvidenceBundle){
 const n=validateOilNarrative(raw,bundle),f=bundle.forecast
 const para=(key:keyof OilNarrative)=>n[key].map(s=>s.text.normalize('NFC')).join(' ')
 const charts=f.series.map(chart)
 const rows=f.series.flatMap(s=>s.models.map(m=>[s.name,names[m.id],fmt(m.point),fmt(m.delta)+'/'+fmt(m.deltaPercent),fmt(m.smape),fmt(m.historicalAverageVerificationPercent),fmt(m.directionalAccuracyPercent),fmt(m.lastMatured.predicted)+'/'+fmt(m.lastMatured.actual),fmt(m.lastMatured.verificationPercent)].join(' | ')))
 const calendar=bundle.market.filter(e=>e.verification==='INDEPENDENTLY_VERIFIED'&&['COMPLETED','SCHEDULED','REVISED','CANCELLED'].includes(e.kind))
 const event=(e:typeof calendar[number])=>e.eventDate!.slice(0,16).replace('T',' ')+' UTC — '+e.publisher+': '+e.title
 const body=[
  '# Oil Market Outlook — Brent & WTI',
  'Asfalt drogowy | asOf '+bundle.asOf+' | pilot wewnętrzny',
  '## 1. Analiza statystyczna',
  'Executive Snapshot: '+para('statistical'),
  'Futures, USD/bbl; Macrobond. Origin '+f.origin+' → '+f.target+': 7 dni od obserwacji, nie od publikacji.',
  '', 'Futures | Cena 30.10 | 23.10 | zmiana USD / %','--- | --- | --- | ---',
  ...f.series.map(s=>s.name+' | '+fmt(s.actual)+' | '+fmt(s.previousWeekValue)+' | '+fmt(s.weekChange)+' / '+fmt(s.weekChangePercent)),
  '',...charts.flatMap(c=>['!['+c.name.split('_')[0]+']('+c.name+')','']),
  'Futures | Model | D7 | Δ USD/% | sMAPE% | Hist.% | Kier.% | ostatnia P/A USD | Spr.%',
  '--- | --- | --- | --- | --- | --- | --- | --- | ---',
  ...rows,
  'Hist.=100−sMAPE, nie prawdopodobieństwo; Kier.=trafność kierunku (Naive: brak ruchu). P/A=prognoza/rzeczywista 23→30.10; Spr.=sprawdzalność tego przypadku. n=40/model/serię; razem '+f.comparisonCount+'.',
  '', '## 2. Kalendarium rynkowe',
  'Minione 7 dni: '+(calendar.filter(e=>e.kind==='COMPLETED').map(event).join('; ')||'brak zweryfikowanych wyników; to nie oznacza braku wydarzeń.'),
  'Kolejne 7 dni, wyniki nieznane: '+(calendar.filter(e=>e.kind==='SCHEDULED').map(event).join('; ')||'terminy niepotwierdzone.'),
  ...calendar.filter(e=>e.kind==='REVISED'||e.kind==='CANCELLED').map(e=>(e.kind==='REVISED'?'Zmienione: ':'Odwołane: ')+event(e)),
  para('calendar'),
  '', '## 3. Realna gospodarka',para('economy'),
  '', '## 4. Procurement Insights',para('procurement'),
  'Region, ekspozycja i formuła: UNSPECIFIED. Futures nie są ceną asfaltu ani ofertą dostawcy. Źródła własne: brak; bibliografia w metadanych.',
  'EXPERIMENTAL_7D / PARTIAL_READY. Przedziały: NOT_AVAILABLE. Rollover i kalendarz sesji niezweryfikowane. Latest-vintage, bez certyfikacji point-in-time. Wymagana ocena człowieka.'
 ].join('\n').normalize('NFC')
 const visibleBody=charts.reduce((text,c)=>text.replace('!['+c.name.split('_')[0]+']('+c.name+')',c.visibleText),body)
 const validation=validateOilRenderedBody(visibleBody)
 return {body,visibleBody,charts,...validation,bodySha256:hash(body),visibleBodySha256:hash(visibleBody),metadata:{schemaVersion:'OilReportLineage/2',evidenceFingerprint:bundle.fingerprint,rawOutputManuallyEdited:false,refs:n,
  nineElements:['header','executiveSnapshot','twoD7Charts','marketTable','forecastAndVerificationTable','previousWeek','nextWeek','asphaltProcurementInsight','methodologyAndSources'],
  countRule:'NFC code points; LF; all SVG text substituted; conservative plain headings/table punctuation included',chartStatus:'TWO_ACTUALS_FOUR_INDEPENDENT_D7_POINTS_NO_BANDS',bibliography:bundle.market,forecastInputSha256:f.inputSha256}}
}
