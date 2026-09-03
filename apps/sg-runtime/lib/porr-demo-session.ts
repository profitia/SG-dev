import {
  PORR_DEMO_SESSION_COOKIE_NAME,
  PORR_DEMO_SESSION_MAX_AGE_SECONDS,
  isPorrDemoSecureCookie,
  resolvePorrDemoCookieDomain,
} from '@/lib/porr-demo-profile'

export type PorrDemoSessionPayload = {
  readonly aud: 'sg-runtime-porr-demo'
  readonly sub: 'porr-demo-access'
  readonly profile: 'porr-demo'
  readonly orgId: string
  readonly userId: string
  readonly orgRole: string
  readonly iat: number
  readonly exp: number
}

type PorrDemoSessionIdentity = {
  readonly orgId: string
  readonly userId: string
  readonly orgRole: string
}

type CookieOptions = {
  readonly name: string
  readonly value: string
  readonly httpOnly: true
  readonly sameSite: 'lax'
  readonly secure: boolean
  readonly path: '/'
  readonly maxAge: number
  readonly domain?: string
}

function encodeBase64UrlFromBytes(bytes: Uint8Array) {
  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(bytes).toString('base64')
    : btoa(String.fromCharCode(...bytes))

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const base64 = `${normalized}${padding}`

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }

  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function encodeJsonPayload(payload: PorrDemoSessionPayload) {
  return encodeBase64UrlFromBytes(new TextEncoder().encode(JSON.stringify(payload)))
}

function decodeJsonPayload(value: string): PorrDemoSessionPayload | null {
  try {
    const json = new TextDecoder().decode(decodeBase64UrlToBytes(value))
    const parsed = JSON.parse(json) as Partial<PorrDemoSessionPayload>
    if (
      parsed.aud !== 'sg-runtime-porr-demo'
      || parsed.sub !== 'porr-demo-access'
      || parsed.profile !== 'porr-demo'
      || typeof parsed.orgId !== 'string'
      || typeof parsed.userId !== 'string'
      || typeof parsed.orgRole !== 'string'
      || typeof parsed.iat !== 'number'
      || typeof parsed.exp !== 'number'
    ) {
      return null
    }

    return parsed as PorrDemoSessionPayload
  } catch {
    return null
  }
}

async function signValue(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return encodeBase64UrlFromBytes(new Uint8Array(signature))
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false
  }

  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index]
  }

  return mismatch === 0
}

export async function createPorrDemoSessionToken(
  secret: string,
  identity: PorrDemoSessionIdentity,
  now = Date.now(),
  maxAgeSeconds = PORR_DEMO_SESSION_MAX_AGE_SECONDS,
) {
  const issuedAt = Math.floor(now / 1000)
  const payload: PorrDemoSessionPayload = {
    aud: 'sg-runtime-porr-demo',
    sub: 'porr-demo-access',
    profile: 'porr-demo',
    orgId: identity.orgId,
    userId: identity.userId,
    orgRole: identity.orgRole,
    iat: issuedAt,
    exp: issuedAt + maxAgeSeconds,
  }
  const encodedPayload = encodeJsonPayload(payload)
  const signature = await signValue(secret, encodedPayload)
  return `${encodedPayload}.${signature}`
}

export async function verifyPorrDemoSessionToken(secret: string, token?: string | null, now = Date.now()) {
  const [encodedPayload, encodedSignature, ...extraParts] = token?.split('.') ?? []
  if (!encodedPayload || !encodedSignature || extraParts.length > 0) {
    return null
  }

  const payload = decodeJsonPayload(encodedPayload)
  if (!payload) {
    return null
  }

  const expectedSignature = await signValue(secret, encodedPayload)
  const providedSignatureBytes = decodeBase64UrlToBytes(encodedSignature)
  const expectedSignatureBytes = decodeBase64UrlToBytes(expectedSignature)

  if (!timingSafeEqual(providedSignatureBytes, expectedSignatureBytes)) {
    return null
  }

  if (payload.exp <= Math.floor(now / 1000)) {
    return null
  }

  return payload
}

export function buildPorrDemoSessionCookie(
  value: string,
  appUrl: string,
  nodeEnv: 'development' | 'test' | 'production',
): CookieOptions {
  const domain = resolvePorrDemoCookieDomain(appUrl)

  return {
    name: PORR_DEMO_SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: isPorrDemoSecureCookie(nodeEnv),
    path: '/',
    maxAge: PORR_DEMO_SESSION_MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  }
}

export function buildExpiredPorrDemoSessionCookie(
  appUrl: string,
  nodeEnv: 'development' | 'test' | 'production',
): CookieOptions {
  return {
    ...buildPorrDemoSessionCookie('', appUrl, nodeEnv),
    value: '',
    maxAge: 0,
  }
}