'use client'

import { useState } from 'react'

export function CopyArtifactButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs px-3 py-1.5 rounded border border-bg-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-bg-hover transition-colors"
    >
      {copied ? 'Copied' : 'Copy handoff'}
    </button>
  )
}