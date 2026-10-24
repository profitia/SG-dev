import type {Actor, BoundRequest} from './operation-context.mjs'
export const REPORT_ADMISSION_CONTRACT: Readonly<{id:'profitia.form-report-admission';version:'1.0.0';schemaVersion:'1.0.0'}>
export const reportAdmissionSchemaUrl:string
export type ReportAdmissionProof=Readonly<{id:string;requestId:string;nip:string}>
export type ReportAdmissionEvidence=Readonly<{id:string;requestId:string;nip:string;applicationId:string;environment:string;organisationId:string;userId:string;payloadDigest:string;schemaDigest:string;expiresAt:string;readyUntil:string;status:'PREPARED'|'RUNNING'|'COMPLETE';identity:Readonly<{issuer:string;subject:string;version:string}>}>
type Query=(sql:string,values?:readonly unknown[])=>Promise<{rows:Record<string,any>[]}>
export function currentReportAdmission():ReportAdmissionProof|null
export function reportAdmissionEvidence(value:unknown):ReportAdmissionEvidence|null
export function admittedReportObservation(value:unknown):Readonly<Record<string,unknown>>|null
export function withoutReportAdmission<T>(action:()=>T):T
export function createReportAdmissionStore(options:{binding:Readonly<{applicationId:string;environment:string;projectId:string;branchId:string;databaseName:string;role:string}>;schemaDigest:string;now?:()=>number}):Readonly<{
 issue(query:Query,input:{requestId:string;nip:string}):Promise<Readonly<{token:string;nip:string;readyUntil:string;expiresAt:string}>>
 load(query:Query,token:string):Promise<ReportAdmissionProof>
 start(query:Query,proof:ReportAdmissionProof):Promise<void>
 run<T>(proof:ReportAdmissionProof,request:Request,action:()=>Promise<T>):Promise<T>
 bindHuman(query:Query,proof:ReportAdmissionProof,request:Readonly<Pick<BoundRequest,'operation'|'organisationId'|'resourceId'>&{payloadDigest:string}>):Promise<Readonly<{admissionId:string;state:Record<string,any>;identityBinding:Record<string,any>}>>
 bindJob(query:Query,proof:ReportAdmissionProof,requestId:string):Promise<void>
 appendJobIntent(query:Query,proof:ReportAdmissionProof,event:import('./operation-context.mjs').AuditEvent):Promise<void>
 jobObservation(state:unknown):Readonly<Record<string,unknown>>
 actor(proof:ReportAdmissionProof):Readonly<Actor>
}>
export function reportAdmissionSchemaDigest():Promise<string>
export function reportAdmissionSourceDigest():Promise<string>
