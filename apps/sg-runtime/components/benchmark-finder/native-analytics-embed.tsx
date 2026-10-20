'use client'

import React, { useEffect, useRef, useState, type ComponentProps } from 'react'
import { useAuth } from '@clerk/react'
import { useSg2IdentityMode } from '@/components/auth/session-boundary'
import { attachNativeDashboardEmbed } from '@/lib/platform/native-dashboard-embed'

type Props = ComponentProps<'iframe'> & { src: string; locale: 'pl' | 'en' }

function NamedAnalyticsEmbed({ locale, ...props }: Props) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const { getToken } = useAuth(), tokenReader = useRef(getToken)
  tokenReader.current = getToken
  const [height, setHeight] = useState<number | null>(null), [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    if (!iframe.current) return
    try {
      const channel = attachNativeDashboardEmbed({ iframe: iframe.current, analyticsUrl: props.src,
        hostWindow: window, getToken: () => tokenReader.current(), onResize: setHeight })
      return () => channel.close()
    } catch { setUnavailable(true) }
  }, [props.src])
  if (unavailable) return <p role="status">{locale === 'pl' ? 'Podgląd jest chwilowo niedostępny.' : 'Preview is temporarily unavailable.'}</p>
  // The Finder mounts this frame only after explicit expansion and eligibility.
  // A second browser-level lazy gate must not delay its identity-channel startup.
  return <iframe {...props} loading="eager" ref={iframe} referrerPolicy="no-referrer"
    style={{ ...props.style, ...(height === null ? {} : { height: `${height}px` }) }} />
}

/** The outer session boundary keys this subtree by principal/session. Changing
 * the URL keys the frame by subject/organisation and closes all old work. */
export function NativeAnalyticsEmbed(props: Props) {
  const mode = useSg2IdentityMode()
  if (mode === 'legacy_demo') { const { locale: _locale, ...iframeProps } = props; return <iframe {...iframeProps} /> }
  if (mode === 'clerk') return <NamedAnalyticsEmbed {...props} />
  return <p role="status">{props.locale === 'pl' ? 'Podgląd jest niedostępny.' : 'Preview is unavailable.'}</p>
}
