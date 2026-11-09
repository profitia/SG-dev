export type Period={fromDate:string;throughDate:string};
export interface ReportCommand {definitionId:'oil-asphalt';profileVersion:string;period:Period;revision:number;asOf:string;allowPartial:boolean}
export interface VerifiedContext {environment:'development';organisationId:string;actorId:string;actorKind:'HUMAN'|'SERVICE';decisionId:string;expiresAt:string}
export interface Job {id:string;editionId:string;organisationId:string;command:ReportCommand;status:'QUEUED'|'RUNNING'|'WAITING_AUTHORIZATION'|'RECONCILIATION_REQUIRED'|'FAILED'|'AWAITING_REVIEW';coverage:'PARTIAL'|'COMPLETE'|null;stages:Record<string,unknown>;calls:Record<string,unknown>;profile:Record<string,unknown>}
export declare const CONTRACT:string; export declare const OPERATIONS:Readonly<Record<'start'|'status'|'list'|'download',string>>;
export declare const CANON_SHA256:string;export declare const SECTIONS:readonly string[];export declare const STAGES:readonly string[];
export declare class ReportError extends Error {code:string;status:number;constructor(code:string,status?:number)}
export declare function requireThat(ok:unknown,code:string,status?:number):asserts ok;
export declare function canonical(v:unknown):string;export declare function digest(v:unknown):string;export declare function day(v:unknown):string;
export declare function command(v:unknown):ReportCommand;export declare function editionKey(org:string,c:ReportCommand):string;export declare function assertContext(c:unknown):VerifiedContext;
export declare function assertProfile(p:Record<string,unknown>):Record<string,unknown>;
