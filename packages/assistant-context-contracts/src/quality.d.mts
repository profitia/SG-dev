import type {ContextReference,ContextStatus} from './index.mjs'
export const QUALITY_CONTRACTS:Readonly<{evidence:'QA_EVIDENCE_V1';verdict:'QUALITY_VERDICT_V1';repair:'REPAIR_MANIFEST_V1';release:'RELEASE_RECEIPT_V1'}>
export type RepairClass='C1'|'C2'|'C3'
export type QualityResult='PASS'|'FAIL'|'INSUFFICIENT_EVIDENCE'
export type QualityAttestation=Readonly<{keyId:string;signature:string}>
export type QualitySourceScope=Readonly<{source:ContextReference['source'];organisationId:string;classification:'SHARED_KNOWLEDGE'|'ORGANISATION_PRIVATE'|'USER_IN_ORGANISATION_PRIVATE';sourceVersion:string|null;rightsVersion:string;validUntil:string;status:ContextStatus;reference:ContextReference}>
export type QualityEvidence=Readonly<{
 schemaVersion:'QA_EVIDENCE_V1';evidenceId:string;interactionId:string;accountId:string;applicationId:'spendguru';environment:'development';occurredAt:string;earliestInputAt:string;timeZone:string
 interpretedPeriod:Readonly<{from:string;to:string;weekStartsOn:'MONDAY'}>|null
 purpose:Readonly<{id:'ASSISTANT_QUALITY';policyVersion:string;grantId:string;validUntil:string}>
 versions:Readonly<{applicationSha:string;model:string;promptSha256:string;modelConfigurationSha256:string;cicVersion:string;gatewayVersion:string}>
 sourceScopes:readonly QualitySourceScope[];modelInput:readonly Readonly<{role:'developer'|'user'|'assistant';content:string}>[]
 output:Readonly<{draft:string;delivered:string;status:'COMPLETE'|'INTERRUPTED'|'FAILED'}>;expiresAt:string
}>
export type QualityVerdict=Readonly<{
 schemaVersion:'QUALITY_VERDICT_V1';evidenceId:string;rubricVersion:string;judgeVersion:string;method:'DETERMINISTIC'|'SEMANTIC_ADVISORY';result:QualityResult
 dimensions:readonly ('LANGUAGE'|'FACTS'|'LOGIC'|'CONTEXT'|'ACCESS')[];harm:'NONE'|'MINOR'|'MAJOR'|'CRITICAL'
 cause:'INTENT'|'CONTEXT'|'SOURCE_DATA'|'INTEGRATION'|'APPLICATION_LOGIC'|'INSTRUCTION_OR_GENERATION'|'UNKNOWN'|null
 evidencePointers:readonly string[];proposedRepairClass:RepairClass|null
}>
export type RepairManifest=Readonly<{
 schemaVersion:'REPAIR_MANIFEST_V1';incidentId:string;repairClass:RepairClass;projectKey:'SG2'|'CIC';repository:'profitia/SG-dev'|'profitia/conversational-intelligence-core';baseSha:string;allowedPaths:readonly string[]
 mandate:Readonly<{id:string;version:string;sha256:string;issuedAt:string;expiresAt:string;attestation:QualityAttestation}>
 gateSetSha256:string;synthetic:Readonly<{fixtureId:string;sha256:string;exportReceiptId:string}>
 limits:Readonly<{maxAttempts:2;maxAttemptSeconds:1800;maxIncidentMicroUsd:5000000}>;correlationId:string
}>
export type ReleaseReceipt=Readonly<{
 schemaVersion:'RELEASE_RECEIPT_V1';incidentId:string;repairClass:RepairClass;projectKey:'SG2'|'CIC';repository:'profitia/SG-dev'|'profitia/conversational-intelligence-core';baseSha:string;sourceSha:string;artifactSha256:string
 verification:Readonly<{runId:string;commitSha:string;gateSetSha256:string;holdoutSha256:string;result:'PASS'}>
 lastKnownGood:Readonly<{sourceSha:string;artifactSha256:string;configurationSha256:string;deployId:string}>
 deployment:Readonly<{environment:'development';serviceId:string;deployId:string;sourceSha:string;configurationSha256:string}>
 acceptance:Readonly<{runId:string;result:QualityResult;observedAt:string}>;state:'RELEASED'|'OBSERVING'|'CLOSED'|'ROLLED_BACK'
 rollback:Readonly<{decisionAt:string|null;completedAt:string|null;sourceSha:string|null;deployId:string|null;verificationRunId:string|null}>
 attestation:QualityAttestation
}>
/** Shape/expiry validation only; never access, signature or release authority. */
export function readQualityEvidence(value:unknown,options:{now:number}):QualityEvidence
export function readQualityVerdict(value:unknown):QualityVerdict
export function readRepairManifest(value:unknown,options:{now:number}):RepairManifest
export function readReleaseReceipt(value:unknown,options:{now:number}):ReleaseReceipt
