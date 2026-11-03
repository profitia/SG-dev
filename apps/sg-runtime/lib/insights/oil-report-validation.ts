import {OIL_SECTIONS,type OilNarrative} from './oil-report-contract'
import type {OilEvidenceBundle} from './oil-report-evidence'
export const countOilReportCharacters=(body:string)=>Array.from(body.normalize('NFC').replace(/\r\n?/g,'\n')).length
export function validateOilNarrative(raw:unknown,bundle:OilEvidenceBundle):OilNarrative {
 if(!raw||typeof raw!=='object'||Object.keys(raw).sort().join(',')!==[...OIL_SECTIONS].sort().join(','))throw Error('REPORT_SECTIONS_INVALID')
 const result=raw as OilNarrative
 for(const section of OIL_SECTIONS){
  if(!Array.isArray(result[section])||result[section].length<1||result[section].length>(section==='statistical'?3:5))throw Error('REPORT_STATEMENTS_INVALID')
  for(const statement of result[section]){
   if(!statement||Object.keys(statement).sort().join(',')!=='evidenceRefs,text'||typeof statement.text!=='string'||!statement.text.trim()
    ||statement.text.length>1600||/[\p{N}\p{Cc}\p{Cf}#|`<>\[\]*_]/u.test(statement.text)||/https?:|www\./i.test(statement.text)
    ||!Array.isArray(statement.evidenceRefs)||!statement.evidenceRefs.length||statement.evidenceRefs.some(id=>!bundle.evidenceIds.includes(id)))throw Error('REPORT_CLAIM_UNGROUNDED')
   if(/(gwarantowan|certyfikowan|pewny zysk|kup natychmiast|sprzedaj natychmiast)/iu.test(statement.text))throw Error('REPORT_CERTAINTY_EXAGGERATED')
   if(['calendar','economy'].includes(section)&&bundle.market.some(e=>e.verification==='INDEPENDENTLY_VERIFIED')
    &&!statement.evidenceRefs.some(id=>bundle.market.some(e=>e.id===id&&e.verification==='INDEPENDENTLY_VERIFIED')))throw Error('REPORT_MARKET_REFERENCE_REQUIRED')
  }
 }
 return structuredClone(result)
}
export function validateOilRenderedBody(body:string){
 const count=countOilReportCharacters(body)
 if(count>4000)throw Object.assign(Error('REPORT_CHARACTER_LIMIT_EXCEEDED'),{actualCharacters:count,maximumCharacters:4000})
 for(const h of ['1. Analiza statystyczna','2. Kalendarium rynkowe','3. Realna gospodarka','4. Procurement Insights'])if(!body.includes(h))throw Error('REPORT_HEADING_MISSING')
 return {characterCount:count,publicationStatus:'HUMAN_REVIEW_REQUIRED' as const}
}
