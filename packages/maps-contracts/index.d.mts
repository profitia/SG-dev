export type MapLocation = Readonly<{id: string; label: string; address?: string; kind?: string; source?: string; position?: Readonly<{lat: number; lng: number}>; status: 'resolved' | 'unresolved'}>
export type MapLocationInput = Omit<MapLocation, 'status'> & {readonly status?: 'resolved' | 'unresolved'}
export const MAPS_CONTRACT: Readonly<{id: 'profitia.maps'; version: '1.0.0'}>
export const MAX_LOCATIONS: number
export const MAX_LOCATION_BYTES: number
export function parseLocations(input: unknown): MapLocation[]
export function exactOrigin(value: string): string
export function isMapsMessage(data: unknown, type: string, instanceId: string): boolean
export function mapsMessage(type: string, instanceId: string, payload?: Record<string, unknown>): Record<string, unknown>
export function parseLocationSelection(value: unknown): {view: 'locations'} | null
