import type {MapLocationInput} from '@profitia/maps-contracts'
export function mountMaps(options: {container: HTMLElement; runtimeOrigin: string; readLocations: (options: {signal: AbortSignal}) => Promise<readonly MapLocationInput[]>; onSelect?: (locationId: string) => void; onStatus?: (status: 'ready' | 'error') => void; timeoutMs?: number}): Readonly<{close(): void}>
