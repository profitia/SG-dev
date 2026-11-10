export declare const ECR_CONTRACT: Readonly<{id: 'profitia.economic-calendar'; version: '1.1.0'}>
export declare const ECR_APPLICATION: string
export declare const ECR_EVENT_RESOURCE: string
export declare const ECR_PREFERENCE_RESOURCE: string
export declare class CalendarError extends Error {code: string; status: number; constructor(code: string, status?: number)}
export interface CalendarFilter {from?: string; to?: string; countries?: string[]; indicators?: string[]; importance?: number[]; eventText?: string; eventIds?: string[]; asKnownAt?: string; limit: number; after?: string}
export interface Preferences {watchedCountries: string[]; watchedIndicators: string[]; watchedTopics: {kind: 'LOCAL_EVENT_TEXT_CONTAINS'; text: string}[]; savedFilters: {name: string; filter: CalendarFilter}[]; display: {timeZone?: string; view?: string}}
export type CalendarValue = string|number|null
export interface EventData {
 eventId:string;publicationId?:string;entityLevel?:'EVENT_RELEASE';schedule?:Record<string,any>;releaseIdentityStatus?:string;source:{provider:'trading-economics'|'eia'|'commodities-sh';vendorEventId:string;sourceRecordRef:string;licenceRef:string;storageBasisRef:string;licenceVersion:string;family?:'publication-calendar';publicationRef?:string;rightsVersion?:string;consumerApplicationId?:string;retentionMode?:string;redistribution?:string};
 eventAt:string|null;eventTimeZone:string|null;dateSpan:0|1|null;country:string|null;indicator:string|null;title:string|null;importance:1|2|3|null;
 values:{actual:CalendarValue;previousAfterRevision:CalendarValue;previousBeforeRevision:CalendarValue;consensusForecast:CalendarValue;vendorForecast:CalendarValue;measurements?:unknown[]};
 reference:{providerValue:string|null;label:string|null;date:string|null};unit:string|null;currency:string|null;providerUpdatedAt:string|null;publishedAt:null;sourceName:string|null;sourceUrl:string|null;historyMeaning:'OBSERVED_BY_ECR_ONLY';
}
export interface CalendarEvent extends EventData {knownAt:string;observation:{receiptRef:string;sourceRetrievedAt:string};freshness:{kind:'LATEST_OBSERVATION'|'LATEST_RETAINED_CHANGE_AS_KNOWN_AT';observedAt:string;sourceRetrievedAt:string}}
export interface CalendarPage {items:CalendarEvent[];order:'CANONICAL_EVENT_ID';nextAfter:string|null;coverage:{scope:'ECR_RETAINED_OBSERVATIONS';completeness:'UNKNOWN';vintageHistory:'OBSERVED_BY_ECR_ONLY';firstObservedAt:string|null;lastObservedAt:string|null}}
export interface PreferenceEnvelope {version:number;preferences:Preferences;createdAt:string|null;updatedAt:string|null}
export interface FavouritePage {items:{eventId:string;savedAt:string;eventAvailability:'REQUIRES_CURRENT_EVENT_READ'}[];nextAfter:string|null;eventContentIncluded:false}
export interface Observation {eventId: string; fingerprint: string; data: EventData; sourceRetrievedAt: string; providerFingerprint: string; receiptRef: string}
export declare function closedObject(value: unknown, keys: string[]): boolean
export declare function canonical(value: unknown): string
export declare function fingerprint(value: unknown): string
export declare function eventId(value: unknown): string
export declare function organisationId(value: unknown): string
export declare function canonicalEventId(provider: string, vendorId: string): string
export declare function instant(value: unknown): string
export declare function calendarFilter(value?: unknown): CalendarFilter
export declare function preferences(value: unknown): Preferences
export declare function calendarObservation(item: unknown): Observation
export declare function changeKinds(previous: any, next: any): string[]

export interface PublicationData {publicationId:string;source:Omit<EventData["source"],"vendorEventId">&{publicationRef:string};title:string;recurrence:string|null;timeZone:string|null;sourceName:string|null;sourceUrl:string|null;entityLevel:"PUBLICATION_DEFINITION";releaseIdentityStatus:string;unresolvedNextSchedule:Record<string,any>|null;historyMeaning:"OBSERVED_BY_ECR_ONLY"}
export interface PublicationObservation {publicationId:string;data:PublicationData;fingerprint:string;sourceRetrievedAt:string;receiptRef:string}
export declare function publicationId(value:unknown):string
export declare function publicationFilter(value?:unknown):{limit:number;after?:string;provider?:"eia"|"commodities-sh";asKnownAt?:string}
export declare function publicationScheduleObservation(item:unknown):{publication:PublicationObservation;event:Observation|null}
