export class RegistryError extends Error {
  constructor(readonly code: string, readonly retryAfter: string|null = null, readonly certainty: 'NOT_SENT'|'UNVERIFIED'|'RESPONSE' = 'NOT_SENT') { super(code) }
}
