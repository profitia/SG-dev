export type DevelopmentTrack = 'SG2' | 'SRM' | 'ARCHITECTURE'
export type DevelopmentContext = Readonly<{ projectKey: DevelopmentTrack; workspaceName: string; targetEnvironment: 'development' }>
export const DEVELOPMENT_CONTRACT_VERSION: '1.0.0'
export function assertDevelopmentContext(actual: DevelopmentContext, expected: DevelopmentContext): DevelopmentContext
export function assertAcceptedContractVersion(version: string): void
export function developmentContractDigest(): string
