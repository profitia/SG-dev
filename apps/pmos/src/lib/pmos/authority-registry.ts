export const CANONICAL_PMOS_AUTHORITIES = {
  memory: 'PMOS',
  continuity: 'PMOS',
  runtime: 'PMOS',
  closeout: 'PMOS',
  conversationPersistence: 'PMOS',
} as const

export type PmosAuthorityDomain = keyof typeof CANONICAL_PMOS_AUTHORITIES
export type PmosAuthorityOwner = (typeof CANONICAL_PMOS_AUTHORITIES)[PmosAuthorityDomain]

export function getPmosAuthorityOwner(domain: PmosAuthorityDomain): PmosAuthorityOwner {
  return CANONICAL_PMOS_AUTHORITIES[domain]
}

export function assertCanonicalPmosAuthorities(
  registry: Record<PmosAuthorityDomain, string> = CANONICAL_PMOS_AUTHORITIES,
): void {
  for (const [domain, owner] of Object.entries(registry) as Array<[PmosAuthorityDomain, string]>) {
    if (owner !== 'PMOS') {
      throw new Error(`PMOS authority registry violation: ${domain} owner is ${owner}, expected PMOS`)
    }
  }
}