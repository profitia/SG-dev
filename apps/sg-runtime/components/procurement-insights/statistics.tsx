'use client'
import React,{useMemo,useState} from 'react'
import {CanonSelect,CanonSummary} from '@profitia/srm-xray'
import type {Statistics} from '@/lib/newsfeed/client'
export function weeklyStatistics(days:Statistics['days']){
 const weeks=new Map<string,Statistics['days'][number]>()
 for(const day of days){const date=new Date(day.date+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);const key=date.toISOString().slice(0,10),row=weeks.get(key)??{date:key,total:0,counts:day.counts.map(()=>0)};row.total+=day.total;day.counts.forEach((n,i)=>row.counts[i]+=n);weeks.set(key,row)}
 return [...weeks.values()]
}
export function NewsfeedStatistics({data}:{data:Statistics}){
 const rows=useMemo(()=>weeklyStatistics(data.days),[data.days]),[phrase,setPhrase]=useState('ALL'),[selectedWeek,setSelectedWeek]=useState('')
 if(data.status==='NO_HISTORY')return <p>Brak zapisanej historii dla tej obserwacji. Zmiana okresu nie uruchamia wyszukiwania.</p>
 if(!rows.length)return <p>Brak danych w wybranym okresie.</p>
 const series=data.phrases.map((s,index)=>({...s,index})).filter(s=>phrase==='ALL'||phrase===s.phrase),chosen=rows.find(x=>x.date===selectedWeek)??rows.at(-1)!
 const max=Math.max(1,...rows.flatMap(d=>series.map(s=>d.counts[s.index]??0))),x=(i:number)=>40+i*640/Math.max(1,rows.length-1),y=(v:number)=>185-v*155/max
 return <section className="pi-statistics"><h3>Publikacje w czasie</h3><p>{data.total} unikalnych publikacji · {data.dateBasis==='publishedAt'?'według daty publikacji':'według daty wykrycia'} · {data.timeZone}</p>
  {data.undated>0&&<p role="status">{data.undated} dopasowanych publikacji nie ma daty wymaganej dla tego wykresu.</p>}
  <div className="pi-actions"><label>Słowo kluczowe lub fraza<CanonSelect canonId="SRM-C16" usage="PI:statistics-phrase" value={phrase} onChange={e=>setPhrase(e.target.value)}><option value="ALL">Wszystkie frazy</option>{data.phrases.map(s=><option key={s.phrase} value={s.phrase}>{s.phrase}</option>)}</CanonSelect></label><label>Tydzień od<CanonSelect canonId="SRM-C16" usage="PI:statistics-week" value={chosen.date} onChange={e=>setSelectedWeek(e.target.value)}>{rows.map(r=><option key={r.date} value={r.date}>{r.date}</option>)}</CanonSelect></label></div>
  <svg viewBox="0 0 720 225" role="img" aria-label="Tygodniowa liczba zapisanych publikacji według fraz. Dokładne wartości są w tabeli.">
   {[0,0.5,1].map(v=><g key={v}><line x1="40" x2="680" y1={y(v*max)} y2={y(v*max)} stroke="currentColor" opacity=".12"/><text x="30" y={y(v*max)+4} textAnchor="end">{Math.round(v*max)}</text></g>)}
   <line x1={x(rows.indexOf(chosen))} x2={x(rows.indexOf(chosen))} y1="30" y2="185" stroke="currentColor" opacity=".2"/>
   {series.map(s=><polyline key={s.phrase} points={rows.map((d,i)=>`${x(i)},${y(d.counts[s.index]??0)}`).join(' ')} fill="none" stroke={['#2e75b6','#2b8c7d','#bd7822','#885aa8'][s.index%4]} strokeWidth="2"/>)}
   <text x="40" y="215">{rows[0].date}</text><text x="680" y="215" textAnchor="end">{rows.at(-1)?.date}</text>
  </svg>
  <p aria-live="polite">Tydzień od {chosen.date}: {series.map(s=>s.phrase+' — '+(chosen.counts[s.index]??0)).join('; ')}. Wszystkie frazy: {chosen.total} unikalnych publikacji.</p>
  <ul className="pi-phrases">{series.map(s=><li key={s.phrase}>{s.phrase}: {s.count}</li>)}</ul>
  <details><CanonSummary canonId="SRM-C49" usage="PI:statistics-table">Dokładne dane wykresu</CanonSummary><div className="pi-table-scroll"><table><caption>Zapisane publikacje według fraz i tygodni</caption><thead><tr><th scope="col">Tydzień od</th>{series.map(s=><th key={s.phrase} scope="col">{s.phrase}</th>)}<th scope="col">Wszystkie frazy (unikalne)</th></tr></thead><tbody>{rows.map(d=><tr key={d.date}><th scope="row">{d.date}</th>{series.map(s=><td key={s.phrase}>{d.counts[s.index]??0}</td>)}<td>{d.total}</td></tr>)}</tbody></table></div></details>
  <p className="pi-note">Tygodnie rozpoczynają się w poniedziałek w wybranej strefie. Bieżący tydzień jest niepełny. Statystyki dotyczą zapisanych tytułów; jedna publikacja może pasować do kilku fraz. Wykres nie potwierdza kompletności wyników dostawcy.</p>
 </section>
}
