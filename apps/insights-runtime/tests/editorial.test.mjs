import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createComposer, qualityGate, composerEvidence} from "../src/composer.mjs";
import {EDITORIAL_PROFILE, EDITORIAL_INSTRUCTION, EDITORIAL_CRITERIA, editorialInstruction, assessEditorial} from "../src/editorial.mjs";
import {SECTIONS, digest} from "../../../packages/insights-contracts/index.mjs";
const fixture=JSON.parse(readFileSync(new URL("./fixtures/editorial.json",import.meta.url)));
const canon=readFileSync(new URL("../../../Canon/v1.0-procurement-insights-narrative-and-editorial-canon.md",import.meta.url),"utf8");
const sha=s=>createHash("sha256").update(s).digest("hex");
const forbidden=()=>assert.fail("OFFLINE_ONLY_NO_PROVIDER_OR_MODEL_REQUEST");
const job={profile:{model:"gpt-6.1-sol",maximumInputTokens:15000,maximumOutputTokens:16000,maximumBodyBytes:65536,counterReservationMicroUsd:100000}};
const pricing={validUntil:"2099-01-01T00:00:00Z",inputMicroUsdPerToken:2,outputMicroUsdPerToken:10,sourceRef:"CONTROLLED_TEST_ONLY"};
const composer=createComposer({counterHost:forbidden,generationHost:forbidden,pricing});
function bundle(c) {
  return {fingerprint:digest(c.facts),asOf:fixture.asOf,period:{fromDate:"2026-11-03",throughDate:"2026-11-09"},
    evidence:[{id:"FIXTURE_EVENT",family:"controlled-editorial",materialDepth:c.facts.materialDepth??"CONTROLLED_FACTS",
      publishedAt:c.facts.publishedAt??"2026-11-09T09:00:00Z",facts:c.facts}],
    market:{series:[]},forecast:{status:"NOT_AVAILABLE",series:[]},missing:[],status:"PARTIAL_READY"};
}
function narrative(text) {return {executive:[{text,refs:["FIXTURE_EVENT"]}]};}
function complete(text,ref="FIXTURE_EVENT") {
  return Object.fromEntries(SECTIONS.map((k,i)=>[k,[{text:i===0?text:`Osobny element redakcyjny: ${k}.`,refs:[ref]}]]));
}
test("published canon embeds exact normative instruction, criteria and immutable substantive sections",()=>{
  const instruction=canon.match(/### 6\.5\.[\s\S]*?```text\n([\s\S]*?)\n```/)[1];
  assert.equal(EDITORIAL_INSTRUCTION,instruction);
  assert.equal(sha(canon.slice(canon.indexOf("## 0."),canon.indexOf("## 11."))),"07a515c420a9af7e3de529dfccb094d6fe6755233defa5a71e0096ce67faa2e8");
  assert.equal(EDITORIAL_PROFILE.canonSha256,sha(canon));
  assert.equal(EDITORIAL_CRITERIA.length,12);
  for(const c of EDITORIAL_CRITERIA)assert(canon.includes(`| ${c.id} | **${c.criterion}** | ${c.question} |`));
  assert(canon.includes("**Status końcowy: APPROVED / ACTIVE.**"));
  assert(!canon.includes("| Status | **DO AKCEPTACJI"));
});
test("actual prepared API body applies universal rules plus existing Oil schema; exact counter uses same instruction",async()=>{
  const b=bundle(fixture.cases[0]),before=structuredClone(b);
  const p=await composer.prepare(job,b),r=JSON.parse(p.body),counter=JSON.parse(p.counterBody);
  assert(r.input[0].content.startsWith(EDITORIAL_INSTRUCTION));
  const legacy=structuredClone(r);legacy.input[0].content=fixture.previousInstruction.content;
  assert.notEqual(digest(legacy),digest(r));
  assert.deepEqual(legacy.input[1],r.input[1]);assert.deepEqual(legacy.text,r.text);
  assert(!fixture.previousInstruction.content.includes("ED-01"));
  assert(fixture.previousInstruction.content.includes("Brak D7 i kalendarza opisz jawnie"));
  assert(!r.input[0].content.includes("Brak D7 i kalendarza opisz jawnie"));
  for(const criterion of EDITORIAL_CRITERIA)assert(r.input[0].content.includes(criterion.question));
  assert.deepEqual(counter,{model:r.model,input:r.input,reasoning:r.reasoning,text:r.text});
  assert.deepEqual(r.text.format.schema.required,SECTIONS);
  assert.equal(r.text.format.strict,true);assert.equal(r.store,false);assert.equal(r.service_tier,"default");
  assert.deepEqual(JSON.parse(r.input[1].content),JSON.parse(JSON.stringify(composerEvidence(b).context)));
  assert.deepEqual(b,before);assert.deepEqual(p.editorialProfile,EDITORIAL_PROFILE);
  assert.equal(p.bodySha256,digest(p.body));
  const again=await composer.prepare(job,JSON.parse(JSON.stringify(b)));assert.equal(again.body,p.body);
});
test("universal instruction and rubric do not impose Oil layout, page or character count on other categories",()=>{
  const instruction=editorialInstruction();
  assert(!/asfalt|rafin|osiem|8000|10000|strony|CFD/.test(instruction));
  for(const category of ["copper","wheat"]) {
    const c=fixture.cases.find(c=>c.category===category);
    const a=assessEditorial({summary:[{text:c.after,refs:["FIXTURE_EVENT"]}],decision:[{text:"Osobny warunek decyzji.",refs:["FIXTURE_EVENT"]}]},bundle(c));
    assert.equal(a.criteria.length,12);assert.equal(a.semanticApproval,false);
  }
});
for(const c of fixture.cases)test(`${c.id}: ${c.category} controlled comparison (authored examples, not model output)`,async()=>{
  const b=bundle(c),before=structuredClone(b),prepared=await composer.prepare(job,b);
  assert.deepEqual(JSON.parse(JSON.parse(prepared.body).input[1].content).evidence[0].facts,c.facts);
  assert.deepEqual(b,before);
  const old=assessEditorial(narrative(c.before),b),next=assessEditorial(narrative(c.after),b);
  for(const id of c.review)assert(next.criteria.some(x=>x.id===id));
  if(c.beforeFinding) {
    assert(old.findings.some(f=>f.code===c.beforeFinding));
    assert(!next.findings.some(f=>f.code===c.beforeFinding));
    assert.equal(old.status,"NEEDS_REVISION");
  }
  // Semantic examples remain unapproved: valid reference IDs do not prove truth.
  assert.equal(next.semanticApproval,false);
  for(const id of ["ED-03","ED-04","ED-05","ED-10","ED-11"])assert.equal(next.criteria.find(x=>x.id===id).status,"HUMAN_REQUIRED");
  if(c.repeatBefore) {
    const repeated={...narrative(c.before),events:[{text:c.before,refs:["FIXTURE_EVENT"]}]};
    assert(assessEditorial(repeated,b).findings.some(f=>f.code==="REPEATED_SENTENCE"));
    const synthesis={...narrative("Większa podaż jest scenariuszem wymagającym potwierdzenia."),events:[{text:c.after,refs:["FIXTURE_EVENT"]}]};
    assert(!assessEditorial(synthesis,b).findings.some(f=>f.code==="REPEATED_SENTENCE"));
  }
  if(c.recommendationElements)for(const element of c.recommendationElements)assert(c.after.includes(element));
  if(c.category==="wheat")assert(!/ropa|rafin|asfalt/.test(c.after));
  if(c.unknownRef)await assert.rejects(qualityGate(job,b,{status:"completed",evidenceFingerprint:b.fingerprint,narrative:complete(c.after,"INVENTED")}),{code:"UNVERIFIED_CITATION"});
});
test("hard evidence checks cannot be compensated by fluent style or editorial assessment",async()=>{
  const c=fixture.cases[1],b=bundle(c),out={status:"completed",evidenceFingerprint:b.fingerprint,narrative:complete(c.after)};
  const gate=await qualityGate(job,b,out);assert.equal(gate.semanticReview,"HUMAN_REQUIRED");assert.equal(gate.automaticPublication,false);
  assert.equal(gate.editorial.hardValidation,"STRUCTURAL_CHECKS_PASSED_SEMANTIC_REVIEW_REQUIRED");
  await assert.rejects(qualityGate(job,b,{...out,evidenceFingerprint:"changed"}),{code:"NARRATIVE_LINEAGE_MISMATCH"});
  await assert.rejects(qualityGate(job,b,{...out,narrative:complete("Cena wzrosła o 50%.")}),{code:"MODEL_NUMERICAL_OR_INTERNAL_CLAIM"});
  await assert.rejects(qualityGate(job,b,{...out,narrative:complete(c.after,"FORGED")}),{code:"UNVERIFIED_CITATION"});
  await assert.rejects(qualityGate(job,b,{...out,narrative:{executive:[]}}),{code:"EIGHT_SECTIONS_REQUIRED"});
});
test("technical validity, poor prose and insufficient material are distinct; repeated hedge words are not a score",async()=>{
  const c=fixture.cases[11],b=bundle(c),out={status:"completed",evidenceFingerprint:b.fingerprint,narrative:complete(c.before)};
  const gate=await qualityGate(job,b,out);assert.equal(gate.status,"PASS_WITH_HUMAN_REVIEW");assert.equal(gate.editorial.status,"NEEDS_REVISION");
  assert.equal(assessEditorial(narrative(c.after),{evidence:[],market:{series:[]},forecast:{series:[]}}).status,"INSUFFICIENT_MATERIAL");
  assert.equal(assessEditorial(narrative(c.after),{...b,missing:["CURRENT_D7_NOT_AVAILABLE"]}).status,"HUMAN_REVIEW_REQUIRED");
  const conditional="Jeśli oferta obejmuje brakujący wolumen, może ograniczyć ryzyko niedostępności; jeśli koszt zwłoki jest niski, kupiec może poczekać na potwierdzenie dostaw.";
  assert.deepEqual(assessEditorial(narrative(conditional),b).findings,[]);
  assert(assessEditorial(narrative("Wynik FIXTURE_EVENT opisuje zmianę."),b).findings.some(f=>f.code==="INTERNAL_REFERENCE_IN_PROSE"));
});
test("input ceiling still fails closed after applying longer instruction",async()=>{
  await assert.rejects(composer.prepare({profile:{...job.profile,maximumBodyBytes:100}},bundle(fixture.cases[0])),{code:"REQUEST_TOO_LARGE"});
});

test("buyer-first validation follows the report opening, not persisted JSON key order", async()=>{
  const c=fixture.cases[1],b=bundle(c);
  const bad=complete(c.before),reordered=Object.fromEntries(Object.entries(bad).reverse());
  assert.notEqual(Object.keys(reordered)[0],"executive");
  for(const narrative of [bad,reordered]){
    const gate=await qualityGate(job,b,{status:"completed",evidenceFingerprint:b.fingerprint,narrative});
    const finding=gate.editorial.findings.find(f=>f.code==="DEFENSIVE_OPENING");
    assert.deepEqual(finding.locations,[{section:"executive",index:0}]);
  }
  const good=complete(c.after);good.asphalt=[{text:c.before,refs:["FIXTURE_EVENT"]}];
  const gate=await qualityGate(job,b,{status:"completed",evidenceFingerprint:b.fingerprint,narrative:Object.fromEntries(Object.entries(good).reverse())});
  assert(!gate.editorial.findings.some(f=>f.code==="DEFENSIVE_OPENING"));
});
