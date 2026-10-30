import React from 'react'
import type {BenchmarkCandidate} from '../../lib/benchmark/contracts'
import {classifyBenchmark} from '../../lib/benchmark/qualification'
import {presentQualification} from '../../lib/benchmark/qualification-presentation'

/** Local metadata projection only; rendering N rows causes zero additional requests. */
export function BenchmarkQualification({candidate,locale,modelContext}:{candidate:BenchmarkCandidate;locale:'pl'|'en';modelContext?:'PCI'}) {
  const profile=classifyBenchmark(candidate),view=presentQualification(profile,locale,modelContext)
  return <div data-testid="benchmark-qualification" data-semantic-class={profile.classification} data-pci-eligibility={view.status}
    style={{fontSize:12,lineHeight:1.5,fontWeight:400,marginTop:6,overflowWrap:'anywhere'}}>
    <strong>{view.classification}</strong>{view.eligibility&&<span> · {view.eligibility}</span>}
    <details><summary>{locale==='pl'?'Dlaczego?':'Why?'}</summary><p>{view.reason}</p>
      {modelContext&&<p>{view.readinessNote}</p>}
      <small>{profile.providerCode} · {profile.seriesId} · {profile.rulesetVersion}</small>
      <dl>{profile.evidence.map(e=><React.Fragment key={e.field}><dt>{e.field}</dt><dd>{e.values.join(' · ')}</dd></React.Fragment>)}</dl>
    </details>
  </div>
}
