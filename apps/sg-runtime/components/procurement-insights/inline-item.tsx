'use client'
import React,{useState} from 'react'
import {CanonSummary,CanonLink,CanonButton} from '@profitia/srm-xray'
import type {Publication} from '@/lib/newsfeed/client'
export function NewsfeedInlineItem({item,locale,expanded=false}:{item:Publication;locale:'pl'|'en';expanded?:boolean}){
 const [copyState,setCopyState]=useState<'idle'|'copied'|'failed'>('idle')
 const date=item.publishedAt?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Warsaw'}).format(new Date(item.publishedAt)):locale==='pl'?'Data publikacji nieznana':'Publication date unknown'
 let href:string|null=null;try{const u=new URL(item.url);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)href=u.href}catch{}
 return <details className="pi-publication" open={expanded||undefined}><CanonSummary canonId="SRM-C49" usage="PI:inline-publication"><span className="pi-material-meta">{item.kind==='WEB_PAGE'?(locale==='pl'?'Wynik wyszukiwania':'Search result'):(locale==='pl'?'Wiadomość':'News')} · {date}</span><strong>{item.headline??(locale==='pl'?'Publikacja bez tytułu':'Untitled publication')}</strong><span className="pi-note">{href?new URL(href).hostname:''} · {locale==='pl'?'Rozwiń materiał':'Expand material'}</span></CanonSummary>
  <div className="pi-publication-body">{item.excerpt?<><small>{locale==='pl'?'Fragment wyniku wyszukiwania':'Search result excerpt'}</small><p>{item.excerpt}</p></>:<p>{locale==='pl'?'Fragment publikacji nie jest dostępny w zapisanej historii. Możesz otworzyć oryginalne źródło.':'An excerpt is not available in saved history. You can open the original source.'}</p>}
   {href&&<div className="pi-actions"><CanonLink canonId="SRM-C03" usage="PI:original-publication" href={href} target="_blank" rel="noopener noreferrer">{locale==='pl'?'Otwórz artykuł':'Open article'} ↗</CanonLink><CanonButton canonId="SRM-C02" usage="PI:copy-publication-link" type="button" onClick={()=>{setCopyState('idle');if(!navigator.clipboard?.writeText){setCopyState('failed');return}void navigator.clipboard.writeText(href!).then(()=>setCopyState('copied'),()=>setCopyState('failed'))}}>{locale==='pl'?'Kopiuj link':'Copy link'}</CanonButton><span role="status">{copyState==='copied'?(locale==='pl'?'Skopiowano link.':'Link copied.'):copyState==='failed'?(locale==='pl'?'Nie udało się skopiować linku. Skorzystaj z odnośnika do artykułu.':'Could not copy the link. Use the article link.'):' '}</span></div>}
  </div></details>
}
