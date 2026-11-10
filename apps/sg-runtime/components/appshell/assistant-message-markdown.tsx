'use client'

import React from 'react'
import Markdown, {type Components} from 'react-markdown'
import remarkGfm from 'remark-gfm'

const shared: Components = {
 a: ({children, href, title}) => href
  ? <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
  : <span>{children}</span>,
 // A model-supplied image URL must not make an automatic third-party request.
 img: ({alt}) => alt ? <span>{alt}</span> : null,
}
// Stable component identities keep the table's scroll position during streaming.
const polish: Components = {
 ...shared,
 table: ({children}) => <div className="srm-chat-table-scroll" role="region" aria-label="Tabela — przewijanie poziome" tabIndex={0}><table>{children}</table></div>,
}
const english: Components = {
 ...shared,
 table: ({children}) => <div className="srm-chat-table-scroll" role="region" aria-label="Table — horizontal scrolling" tabIndex={0}><table>{children}</table></div>,
}
const plugins = [remarkGfm]

/** Presentation only: both live deltas and saved responses use the same parser. */
export function AssistantMessageMarkdown({content, en}: {content: string; en: boolean}) {
 return <div className="srm-chat-markdown"><Markdown remarkPlugins={plugins} components={en ? english : polish} skipHtml>{content}</Markdown></div>
}
