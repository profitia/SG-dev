import {createHash} from 'node:crypto'
import {FROZEN_OIL_D0_SHA256,assertFrozenOilProjection,type OilProjection} from '../forecast/oil-d0-report-projection'
export interface OilMarketEvidence {id:string;publisher:string;title:string;url:string;publicationDate:string|null;eventDate:string|null;retrievedAt:string;summary:string;licence:string;verification:'INDEPENDENTLY_VERIFIED'|'UNAVAILABLE'|'UNCONFIRMED';kind:'FACT'|'COMPLETED'|'SCHEDULED'|'REVISED'|'CANCELLED';availableAt:string|null}
export interface OilEvidenceBundle {schemaVersion:'ReportEvidenceBundle/Oil/1';asOf:string;forecast:OilProjection;market:OilMarketEvidence[];category:{name:'asfalt drogowy';region:'UNSPECIFIED';exposure:'UNSPECIFIED';userUrls:[]};evidenceIds:string[];warnings:readonly string[];fingerprint:string}
export function makeOilEvidenceBundle(forecast:OilProjection,market:OilMarketEvidence[],asOf:string):OilEvidenceBundle {
 assertFrozenOilProjection(forecast)
 const time=Date.parse(asOf)
 if(!Number.isFinite(time)||!asOf.includes('T')||time<Date.parse('2026-11-02T00:00:00Z')||forecast.inputSha256!==FROZEN_OIL_D0_SHA256)throw Error('EVIDENCE_IDENTITY_INVALID')
 const ids=new Set<string>()
 for(const e of market){
  let u:URL;try{u=new URL(e.url)}catch{throw Error('EVIDENCE_URL_INVALID')}
  if(!/^[A-Z][A-Z0-9_-]{1,63}$/.test(e.id)||ids.has(e.id)||u.protocol!=='https:'||u.username||u.password||u.hash
   ||!e.publisher.trim()||!e.title.trim()||!e.licence.trim()||!e.summary.trim()||Buffer.byteLength(JSON.stringify(e))>6000
   ||!Number.isFinite(Date.parse(e.retrievedAt))||Date.parse(e.retrievedAt)>time)throw Error('EVIDENCE_METADATA_INVALID')
  ids.add(e.id)
  if(e.verification==='INDEPENDENTLY_VERIFIED'){
   if(!e.availableAt||!e.publicationDate||!Number.isFinite(Date.parse(e.availableAt))||!Number.isFinite(Date.parse(e.publicationDate))
    ||Date.parse(e.availableAt)>time||Date.parse(e.publicationDate)>time)throw Error('EVIDENCE_LOOKAHEAD')
   if(['COMPLETED','SCHEDULED','REVISED','CANCELLED'].includes(e.kind)){
    if(!e.eventDate||!Number.isFinite(Date.parse(e.eventDate)))throw Error('CALENDAR_DATE_UNCONFIRMED')
    const days=(Date.parse(e.eventDate)-time)/86400000
    if(days < -7||days>7||e.kind==='COMPLETED'&&days>0||e.kind==='SCHEDULED'&&days<=0)throw Error('CALENDAR_WINDOW_INVALID')
   }
  }
 }
 const data={schemaVersion:'ReportEvidenceBundle/Oil/1' as const,asOf,forecast,market:structuredClone(market),category:{name:'asfalt drogowy' as const,region:'UNSPECIFIED' as const,exposure:'UNSPECIFIED' as const,userUrls:[] as []},
  evidenceIds:['D0',...forecast.series.flatMap(s=>[s.id,...s.models.map(m=>s.id+':'+m.id)]),...market.filter(e=>e.verification==='INDEPENDENTLY_VERIFIED').map(e=>e.id)],
  warnings:forecast.limitations}
 return {...data,fingerprint:createHash('sha256').update(JSON.stringify(data)).digest('hex')}
}
export function oilEvidenceCoverage(bundle:OilEvidenceBundle){
 const verified=bundle.market.filter(e=>e.verification==='INDEPENDENTLY_VERIFIED')
 return {verifiedSources:new Set(verified.map(e=>e.publisher)).size,completedEvents:verified.filter(e=>e.kind==='COMPLETED').length,scheduledEvents:verified.filter(e=>e.kind==='SCHEDULED').length,
  internalPreparationOnly:true,privateUserSourcesIncluded:false,unavailableIsNotNoNews:true}
}
