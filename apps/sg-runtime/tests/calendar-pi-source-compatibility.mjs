// Test/build-only bridge to the existing exact Calendar verifier.
// Ordinary source authentication remains owned by the trusted CI admission.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {completeFunctionalPredecessor,COMPLETE_FUNCTIONAL_PRODUCER_RECORD,COMPLETE_FUNCTIONAL_CONSUMER_RECORD} from '../../architecture-lab/ecr-complete-functional-source.mjs';
export const CALENDAR_PI_BASE='df57c042e2fbd60fc14ea7f883f245ea6be8e2ee';
export const CALENDAR_PI_HOOK='apps/sg-runtime/tests/procurement-insights-live-acceptance-source.mjs';
export const CALENDAR_PI_PATHS=Object.freeze([CALENDAR_PI_HOOK,'apps/sg-runtime/tests/calendar-pi-source-compatibility.mjs','apps/sg-runtime/tests/calendar-pi-source-compatibility.test.mjs']);
const IMPORT="import {calendarPiPredecessor} from './calendar-pi-source-compatibility.mjs';\nimport './calendar-pi-source-compatibility.test.mjs';\n";
const HEAD="export function procurementInsightsLiveAcceptancePredecessor(current,historical){\n";
const PREFIX=" const calendar=calendarPiPredecessor(current,historical);\n if(calendar){\n  const accepted=procurementInsightsLiveAcceptancePredecessor(calendar.previousBytes,historical);assert(accepted,'accepted PI live source retained');\n  return {...accepted,completeFunctional:calendar.complete,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...calendar.sourceDigests}}};\n }\n";
const hash=b=>createHash('sha256').update(b).digest('hex');
const BASE_DIGEST='9a4d1698dd847d152246374d83aaa9f7f0e6fa76f80c6793ae40bd52aa3ee0d4';
export function calendarPiCompletionSource(before){
 assert.equal(before.split(HEAD).length,2,'one unchanged PI entry point');
 return IMPORT+before.replace(HEAD,HEAD+PREFIX);
}
export function calendarPiPredecessor(current,historical){
 let hook;try{hook=Buffer.from(current(CALENDAR_PI_HOOK))}catch(error){
  const text=String(error?.stderr??error?.message??'');
  if(error?.code==='ENOENT'||error?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+CALENDAR_PI_HOOK+s)))return null;
  throw error;
 }
 if([BASE_DIGEST,'69e7eff5b5f1cd8fda185074ccac2fcee149b937d3f720dcb95d582b753c39bb'].includes(hash(hook)))return null;
 const before=Buffer.from(historical(CALENDAR_PI_BASE,CALENDAR_PI_HOOK));
 assert.equal(hash(before),BASE_DIGEST,'immutable accepted PI hook');
 assert.equal(hook.toString(),calendarPiCompletionSource(before.toString()),'only the additive Calendar dispatch; all PI assertions retained');
 const complete=completeFunctionalPredecessor(current,historical);
 const sourceDigests=Object.fromEntries(CALENDAR_PI_PATHS.map(p=>[p,hash(current(p))]));
 if(complete){
  Object.assign(sourceDigests,complete.currentSourceDigests??{...complete.producer.sourceDigests,...complete.consumer?.sourceDigests});
  sourceDigests[COMPLETE_FUNCTIONAL_PRODUCER_RECORD]=hash(current(COMPLETE_FUNCTIONAL_PRODUCER_RECORD));
  if(complete.consumer)sourceDigests[COMPLETE_FUNCTIONAL_CONSUMER_RECORD]=hash(current(COMPLETE_FUNCTIONAL_CONSUMER_RECORD));
 }
 const read=complete?.previousBytes??current;
 return {complete,sourceDigests,previousBytes:p=>{
  if(p===CALENDAR_PI_HOOK)return Buffer.from(before);
  if(CALENDAR_PI_PATHS.includes(p))throw Object.assign(Error('Calendar PI bridge absent from predecessor'),{code:'ENOENT'});
  return read(p);
 }};
}
