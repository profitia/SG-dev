import React from 'react'
import type {BenchmarkCandidate} from '../../lib/benchmark/contracts'
import {classifyBenchmark} from '../../lib/benchmark/qualification'
import {presentQualification} from '../../lib/benchmark/qualification-presentation'

/** Local metadata projection only; rendering N rows causes zero additional requests. */
export function BenchmarkQualification({candidate,locale,modelContext}:{candidate:BenchmarkCandidate;locale:'pl'|'en';modelContext?:'PCI'}) {
  const profile=classifyBenchmark(candidate),view=presentQualification(profile,locale,modelContext)
  const colors={SUITABLE:{fg:'#12653d',bg:'#e3f5e9',icon:'✓'},UNSUITABLE:{fg:'#a32424',bg:'#fde8e8',icon:'✕'},VERIFY:{fg:'#794a00',bg:'#fff1c9',icon:'!'},NOT_EVALUATED:{fg:'#445266',bg:'#edf0f4',icon:'?'}}
  const badge=colors[view.status??'NOT_EVALUATED']
  return <div data-testid="benchmark-qualification" data-semantic-class={profile.classification} data-pci-eligibility={view.status}
    style={{fontSize:12,lineHeight:1.5,fontWeight:400,marginTop:6,overflowWrap:'anywhere'}}>
    <strong>{view.classification}</strong>{view.eligibility&&<span style={{display:'inline-block',padding:'2px 6px',marginLeft:5,borderRadius:4,color:badge.fg,background:badge.bg,fontWeight:600}}><span aria-hidden>{badge.icon} </span>{view.eligibility}</span>}
    <details style={{position:'relative',zIndex:2,pointerEvents:'auto'}}><summary>{locale==='pl'?'Dlaczego?':'Why?'}</summary><p>{view.reason}</p>
      {modelContext&&<p>{view.readinessNote}</p>}
      <small>{profile.providerCode} · {profile.seriesId} · {profile.rulesetVersion}</small>
      <dl>{profile.evidence.map(e=><React.Fragment key={e.field}><dt>{e.field}</dt><dd>{e.values.join(' · ')}</dd></React.Fragment>)}</dl>
    </details>
  </div>
}
