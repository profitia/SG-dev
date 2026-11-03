import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {prepareOilResponsesCommand,oilReportSourceCandidate,validateOilTokenReceipt,createOilEvaluationSource} from '../lib/insights/oil-report-source'
import type {OilEvidenceBundle} from '../lib/insights/oil-report-evidence'
import {makeOilEvidenceBundle} from '../lib/insights/oil-report-evidence'
import {projectFrozenOilD0} from '../lib/forecast/oil-d0-report-projection'
import {OIL_B1,validateOilEvaluationGo,type OilEvaluationGo} from '../lib/insights/oil-report-source'
import {externalCallSourceDigest} from '@profitia/platform-contracts/external-call'
import {createHash} from 'node:crypto'
import targets from '../deployment/benchmark-discovery-targets.json'
const b=JSON.parse(fs.readFileSync(new URL('./fixtures/oil-d0-report-projection.json',import.meta.url),'utf8')) as OilEvidenceBundle
test('closed Responses preparation has exact model/schema/privacy and no tools, background or credential',()=>{
 const c=prepareOilResponsesCommand(b),v=JSON.parse(c.body)
 assert.equal(c.url,'https://api.openai.com/v1/responses');assert.equal(v.model,'gpt-6.1-sol');assert.equal(v.store,false)
 assert.equal(v.text.format.strict,true);assert.equal(v.max_output_tokens,32000);assert.equal(v.reasoning.effort,'high')
 for(const k of ['tools','background','previous_response_id','api_key'])assert.equal(k in v,false)
 assert.equal(oilReportSourceCandidate().status,'PROPOSED_NOT_ADMITTED')
 assert.throws(()=>validateOilTokenReceipt(c,{verified:false,count:10,model:v.model,bodySha256:c.bodySha256}))
})
test('B1 Source rejects a serialized evidence object before any credential, database or HTTP access',async()=>{
 await assert.rejects(createOilEvaluationSource({bundle:b} as Parameters<typeof createOilEvaluationSource>[0]),/EVIDENCE_NOT_PREPARED/)
})
test('legacy SDK cannot ignore USD policy; isolated model SDK still needs original current Source after a valid local GO instruction',{
 skip:!process.env.OIL_D0_READONLY_FILE||!process.env.OIL_LAST_CASE_READONLY_FILE},async()=>{
 const bundle=makeOilEvidenceBundle(projectFrozenOilD0(fs.readFileSync(process.env.OIL_D0_READONLY_FILE!),fs.readFileSync(process.env.OIL_LAST_CASE_READONLY_FILE!)),[],'2026-11-03T06:29:25Z')
 let queries=0,credentials=0,tokens=0
 const artifactSha256='a'.repeat(64),deploymentId='oil-b1-'+artifactSha256,configurationVersion='SYNTHETIC_ONLY'
 const input={bundle,artifactSha256,externalConfigurationVersion:configurationVersion,
  root:{application:{appId:targets.source.applicationId,profileId:'PLATFORM_INTERNAL' as const,environment:'development' as const,deploymentId,configurationVersion,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest' as const]},
   binding:{applicationId:targets.source.applicationId,environment:'development' as const,projectId:targets.source.projectId,branchId:targets.source.branchId,databaseName:targets.source.databaseName,role:OIL_B1.role,deploymentId,configurationVersion,schemaDigest:targets.source.sourceSqlDigest},
   independentQuery:async()=>{queries++;throw Error('SYNTHETIC current Source unavailable')},transact:async()=>{throw Error('SYNTHETIC transaction unavailable')}},
  countModelInputTokens:()=>{tokens++;return 1},existingCredential:async()=>{credentials++;throw Error('Never obtain a credential')},query:async()=>{throw Error('Never transact')}}
 if(await externalCallSourceDigest()!==OIL_B1.producerExternalDigest){await assert.rejects(createOilEvaluationSource(input));assert.equal(queries,0)}
 else{
  const source=await createOilEvaluationSource(input)
  const data={schemaVersion:'OilB1FinalGo/1',decision:'GO_ONE_ATTEMPT',operation:OIL_B1.operation,admissionSha256:OIL_B1.admissionSha256,
   requestSha256:source.command.bodySha256,evidenceFingerprint:bundle.fingerprint,artifactSha256,asOf:bundle.asOf,expiresAt:new Date(Date.now()+60000).toISOString(),intentKey:'b'.repeat(64),
   projectId:OIL_B1.projectId,model:'gpt-6.1-sol',reservationMicroUsd:4900000,ownerGoRef:'SYNTHETIC_ONLY',controlledReleaseRef:'SYNTHETIC_ONLY',activeKeyProjectProofRef:'SYNTHETIC_ONLY',tokenCounterAcceptanceRef:'SYNTHETIC_ONLY',previousLiabilityAcceptanceRef:'SYNTHETIC_ONLY'} as OilEvaluationGo
  await assert.rejects(source.execute(data,AbortSignal.timeout(1000)));assert.equal(queries,0)
  const bytes=Buffer.from(JSON.stringify(data)),go=validateOilEvaluationGo(bytes,createHash('sha256').update(bytes).digest('hex'),source)
  await assert.rejects(source.execute(go,AbortSignal.timeout(1000)));assert.equal(queries,1)
  await assert.rejects(source.execute(go,AbortSignal.timeout(1000)));assert.equal(queries,1)
 }
 assert.equal(credentials,0);assert.equal(tokens,0)
})
