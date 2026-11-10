export const ORGANISATION_PROFILE_CONTRACT:Readonly<{id:'profitia.organisation-profile';version:'1.0.0'}>
export class OrganisationProfileError extends Error {readonly code:string}
export type ProcurementIndustryId='construction'|'manufacturing'|'food'|'other'
export type CatalogueCategory=Readonly<{id:string;label:string}>
export const PROCUREMENT_INDUSTRIES:readonly Readonly<{id:ProcurementIndustryId;label:string;categories:readonly CatalogueCategory[]}>[]
export const PROCUREMENT_TEAM_RANGES:readonly Readonly<{id:'1-5'|'6-10'|'11+';label:string;minimum:number;maximum:number|null}>[]
export type ProcurementCategoryInput=Readonly<{catalogueId:string}>|Readonly<{customName:string}>
export type ProcurementCategory=Readonly<{catalogueId:string|null;label:string;key:string;source:'USER'}>
export type CompanyRecord=Readonly<{entityType:'COMPANY';country:'PL';nip:string;krs:string;regon:string;legalName:string;address:string;postalCode:string}>
export function normalizePolishNip(value:unknown):string
export function normalizeOrganisationSlug(value:unknown):string
export function suggestOrganisationSlug(legalName:unknown):string
export function normalizeIndustry(value:unknown):Readonly<{id:ProcurementIndustryId;label:string;source:'USER'}>
export function normalizeProcurementCategories(value:unknown):readonly ProcurementCategory[]
export function normalizeTeamRange(value:unknown):Readonly<{id:'1-5'|'6-10'|'11+';label:string;minimum:number;maximum:number|null;includesRespondent:true;source:'USER'}>
export function normalizeCompanyRecord(value:unknown,expectedNip:unknown):CompanyRecord
export function normalizeInvitationEmails(value:unknown,ownEmail:unknown):readonly string[]
export function organisationCommandDigest(value:unknown):string

export type OnboardingDraftPatch=Readonly<{nip?:string;slug?:string;industry?:Readonly<{id:ProcurementIndustryId;label?:string}>;categories?:readonly ProcurementCategoryInput[];teamRange?:'1-5'|'6-10'|'11+'}>
export type OnboardingDraft=Readonly<{userId:string;version:string;answers:Readonly<Record<string,unknown>>}>
export function normalizeOnboardingDraftPatch(value:unknown):Readonly<Record<string,unknown>>
export const organisationOnboardingSchemaUrl:string
export function organisationOnboardingSchemaDigest():string
export function createOrganisationOnboardingDraftBackend<T>(options:import('./identity-provisioning.mjs').IdentityProvisioningOptions<T> & {
 application:import('./operation-context.mjs').Application;independentQuery:import('./access-store.mjs').AccessQuery
}):Readonly<{ready():Promise<void>;readCurrentDraft(request:Request):Promise<OnboardingDraft>;saveCurrentDraft(request:Request,input:{expectedVersion:string;patch:OnboardingDraftPatch}):Promise<OnboardingDraft>}>
