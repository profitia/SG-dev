'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AdvisoryWidget,
  type AdvisoryWidgetEvent,
  type AdvisoryWidgetMessage,
  type AdvisoryWidgetRecommendation,
} from '@profitia/advisory-widget'
import type { Locale } from '@/i18n/routing'
import {
  SPENDGURU_ADVISORS,
  SPENDGURU_WIDGET_COPY,
} from '@/lib/advisory/config'

interface SpendGuruAdvisoryWidgetProps {
  locale: Locale
  enabled: boolean
}

interface AdvisoryResponse {
  content: string
  recommendation: null | {
    id: string
    href: string
    title: string
    description: string
    actionLabel: string
  }
  rationale: null | {
    contextLabel: string
    summary: string
    lead: string
  }
}

export function SpendGuruAdvisoryWidget({ locale, enabled }: SpendGuruAdvisoryWidgetProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<AdvisoryWidgetMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [recommendation, setRecommendation] = useState<AdvisoryWidgetRecommendation | null>(null)
  const copy = SPENDGURU_WIDGET_COPY[locale]
  const contactHref = locale === 'pl' ? 'https://profitia.pl/kontakt' : 'https://profitia.pl/en/contact'

  const messagePayload = useMemo(() => messages.map(({ role, content }) => ({ role, content })), [messages])

  if (!enabled) return null

  const send = async (content: string) => {
    const userMessage: AdvisoryWidgetMessage = { id: crypto.randomUUID(), role: 'user', content }
    const nextPayload = [...messagePayload, { role: 'user' as const, content }]
    setMessages((current) => [...current, userMessage])
    setRecommendation(null)
    setIsTyping(true)

    try {
      const response = await fetch('/api/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, messages: nextPayload }),
      })
      if (!response.ok) throw new Error('advisory_request_failed')
      const result = await response.json() as AdvisoryResponse
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
      }])
      if (result.recommendation && result.rationale) {
        setRecommendation({ ...result.recommendation, ...result.rationale })
      }
    } catch {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: copy.errorMessage ?? '',
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const track = (event: AdvisoryWidgetEvent) => {
    window.dispatchEvent(new CustomEvent('spendguru:advisory-event', { detail: event }))
    const analyticsWindow = window as typeof window & { dataLayer?: Array<Record<string, unknown>> }
    analyticsWindow.dataLayer?.push({ event: `spendguru_advisory_${event.type}`, ...event })
  }

  return (
    <AdvisoryWidget
      id="spendguru-advisory"
      locale={locale}
      copy={copy}
      advisors={SPENDGURU_ADVISORS}
      messages={messages}
      isTyping={isTyping}
      recommendation={recommendation}
      contact={{ href: contactHref, label: copy.contactLabel }}
      onSend={send}
      onNavigate={(href) => href.startsWith('/') ? router.push(href) : window.location.assign(href)}
      onEvent={track}
      preferences={{
        advisorKey: 'spendguru.advisory.advisor.v1',
        invitationKey: 'spendguru.advisory.invitation.v1',
        attentionKey: 'spendguru.advisory.attention.v1',
      }}
      theme={{ primary: '#0e4f8a', primaryHover: '#0b3f6e', accent: '#d12177' }}
    />
  )
}
