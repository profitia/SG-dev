'use client'

import React, {useId, useMemo} from 'react'
import Markdown, {type Components} from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {normalizeLegacyReportTables} from '../../lib/procurement-insights/report-markdown'

const plugins = [remarkGfm]

/** Displays the stored edition without changing its content, hashes or context reference. */
export function ReportText({text, locale}: {text: string; locale: 'pl' | 'en'}) {
 const id = useId()
 const prefix = 'pi-report-' + id.replace(/:/g, '') + '-'
 const en = locale === 'en'
 const components = useMemo<Components>(() => ({
  h1: ({children}) => <h3>{children}</h3>,
  h2: ({children}) => <h3>{children}</h3>,
  h3: ({children}) => <h4>{children}</h4>,
  h4: ({node: _node, id, children, ...props}) =>
   <h4 {...props} id={id === 'footnote-label' ? prefix + 'footnote-label' : id}>{children}</h4>,
  a: ({node: _node, children, href, ...props}) => {
   if (!href) return <span>{children}</span>
   const describedBy = props['aria-describedby'] === 'footnote-label'
    ? prefix + 'footnote-label' : props['aria-describedby']
   return href.startsWith('#')
    ? <a {...props} href={href} aria-describedby={describedBy}>{children}</a>
    : <a {...props} href={href} aria-describedby={describedBy} target="_blank" rel="noopener noreferrer">{children}</a>
  },
  // Reading an edition must not load third-party images.
  img: ({alt}) => alt ? <span>{alt}</span> : null,
  table: ({children}) => <div className="pi-table-scroll srm-chat-table-scroll" role="region"
   aria-label={en ? 'Table — horizontal scrolling' : 'Tabela — przewijanie poziome'} tabIndex={0}><table>{children}</table></div>,
 }), [en, prefix])
 return <div className="pi-report-text srm-chat-markdown">
  <Markdown remarkPlugins={plugins} components={components} skipHtml remarkRehypeOptions={{
   clobberPrefix: prefix,
   footnoteLabel: en ? 'Source notes' : 'Przypisy',
   footnoteLabelTagName: 'h4',
   footnoteLabelProperties: {},
   footnoteBackLabel: (referenceIndex, rereferenceIndex) =>
    (en ? 'Back to reference ' : 'Wróć do odwołania ') + (referenceIndex + 1) + (rereferenceIndex > 1 ? '-' + rereferenceIndex : ''),
  }}>{normalizeLegacyReportTables(text)}</Markdown>
 </div>
}
