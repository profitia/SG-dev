import React from 'react'
import type {BenchmarkCandidate} from '../../lib/benchmark/contracts'
import {classifyBenchmark} from '../../lib/benchmark/qualification'
import {presentQualification} from '../../lib/benchmark/qualification-presentation'
export type QualificationFilter='ALL'|'SUITABLE'|'VERIFY'|'UNSUITABLE'
/** Metadata-only display filter. Stable input order, zero provider/authentication calls. */
export function matchesQualification(candidate:BenchmarkCandidate,filter:QualificationFilter){return filter==='ALL'||presentQualification(classifyBenchmark(candidate),'en','PCI').status===filter}
export function BenchmarkQualificationFilter({locale,value,onChange}:{locale:'pl'|'en';value:QualificationFilter;onChange:(value:QualificationFilter)=>void}){
 const labels=locale==='pl'?['Wszystkie','Odpowiednie do PCI','Wymaga weryfikacji','Nieodpowiednie do PCI']:['All','Suitable for PCI','Requires verification','Unsuitable for PCI']
 return <label style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,fontSize:12}}>{locale==='pl'?'Przydatność do PCI':'PCI suitability'}<select aria-label={locale==='pl'?'Filtr przydatności do PCI':'PCI suitability filter'} value={value} onChange={e=>onChange(e.target.value as QualificationFilter)} style={{color:'inherit',background:'var(--surface, transparent)',border:'1px solid currentColor',borderRadius:6,padding:'5px 8px'}}>{(['ALL','SUITABLE','VERIFY','UNSUITABLE'] as const).map((v,i)=><option key={v} value={v}>{labels[i]}</option>)}</select></label>
}
