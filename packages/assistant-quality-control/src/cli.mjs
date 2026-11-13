import {SOURCE_PATHS,documentDigest} from './manifest.mjs'

/** Prepare reviewable unsigned metadata. These builders create no signature,
 * role, permission, resource, wallet, installation or runtime activation. The
 * owner and independent exporter must attest through their separate channels. */
export function ownerMandateBody({id,issuedAt,expiresAt,targetServiceId,gateSetSha256}){
 return {id,version:'1.0.0',applicationId:'spendguru',environment:'development',stage:'E1',issuedAt,expiresAt,
  projectKey:'SG2',repository:'profitia/SG-dev',targetServiceId,classes:['C1','C2','C3'],sourcePaths:SOURCE_PATHS,gateSetSha256,
  controlledFixtureOnly:true,maxActiveExecutorsPerRepository:1,maxNewRepairReleasesPer24h:1,maxAttempts:2,maxAttemptSeconds:1800,
  maxIncidentMicroUsd:5000000,maxPilotMicroUsd:50000000,maxPilotDays:14,minimumHoldoutCases:200,criticalRegressionsAllowed:0,maxPatchBytes:32768,maxChangedLines:300}
}
export function repairManifestBody({mandate,incidentId,correlationId,baseSha,repairClass,exportReceiptId,fixtureSha256}){
 const b=mandate.body
 return {schemaVersion:'REPAIR_MANIFEST_V1',incidentId,repairClass,projectKey:'SG2',repository:'profitia/SG-dev',baseSha,
  allowedPaths:[SOURCE_PATHS[repairClass],`apps/sg-runtime/tests/assistant-quality-regressions/${incidentId}.test.ts`],
  mandate:{id:b.id,version:b.version,sha256:documentDigest(b),issuedAt:b.issuedAt,expiresAt:b.expiresAt,attestation:mandate.attestation},gateSetSha256:b.gateSetSha256,
  synthetic:{fixtureId:'qa_synthetic_'+fixtureSha256,sha256:fixtureSha256,exportReceiptId},limits:{maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000},correlationId}
}
