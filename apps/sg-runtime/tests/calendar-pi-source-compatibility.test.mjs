import {calendarCurrentMainPredecessor} from '../../architecture-lab/calendar-current-main-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {calendarPiPredecessor,calendarPiCompletionSource,CALENDAR_PI_BASE,CALENDAR_PI_HOOK,CALENDAR_PI_PATHS} from './calendar-pi-source-compatibility.mjs';
import {COMPLETE_FUNCTIONAL_PRODUCER_PATHS,COMPLETE_FUNCTIONAL_CONSUMER_PATHS,COMPLETE_FUNCTIONAL_PRODUCER_RECORD,COMPLETE_FUNCTIONAL_CONSUMER_RECORD} from '../../architecture-lab/ecr-complete-functional-source.mjs';
const root=new URL('../../../',import.meta.url),physical=p=>readFileSync(new URL(p,root)),cache=new Map();
const historical=(sha,p)=>{const k=sha+':'+p;if(!cache.has(k))cache.set(k,execFileSync('git',['show',k],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(k)};
const current=calendarCurrentMainPredecessor(physical,historical)?.calendarBytes??physical;
test('Calendar PI bridge authenticates all new source before restoring the unchanged PI hook',()=>{
 const view=calendarPiPredecessor(current,historical);assert(view);assert(view.complete);
 assert.deepEqual(view.previousBytes(CALENDAR_PI_HOOK),historical(CALENDAR_PI_BASE,CALENDAR_PI_HOOK));
 assert.equal(calendarPiPredecessor(view.previousBytes,historical),null);
 for(const p of CALENDAR_PI_PATHS)assert(Object.hasOwn(view.sourceDigests,p));
 for(const p of [COMPLETE_FUNCTIONAL_PRODUCER_RECORD,...COMPLETE_FUNCTIONAL_PRODUCER_PATHS])assert.throws(()=>calendarPiPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p);
 for(const p of Object.keys(view.complete.producer.preservedReceipts))assert.throws(()=>calendarPiPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p);
});
test('Calendar PI bridge rejects hook edits, historical substitution, undeclared consumer and unreadable input',()=>{
 assert.throws(()=>calendarPiPredecessor(p=>p===CALENDAR_PI_HOOK?Buffer.concat([current(p),Buffer.from('UNACCEPTED')]):current(p),historical));
 assert.throws(()=>calendarPiPredecessor(current,(sha,p)=>Buffer.concat([historical(sha,p),Buffer.from('UNACCEPTED')])));
 assert.throws(()=>calendarPiPredecessor(p=>p===COMPLETE_FUNCTIONAL_CONSUMER_RECORD?Buffer.from('{}'):current(p),historical));
 assert.throws(()=>calendarPiPredecessor(()=>{throw Object.assign(Error('denied'),{code:'EACCES'})},historical),{code:'EACCES'});
 const before=historical(CALENDAR_PI_BASE,CALENDAR_PI_HOOK);
 assert.equal(calendarPiPredecessor(p=>p===CALENDAR_PI_HOOK?before:current(p),historical),null);
 assert.throws(()=>calendarPiCompletionSource('unrelated source'));
});

test('the same bridge binds the original seven-file consumer without altering its record or producer',()=>{
 const paths=[...COMPLETE_FUNCTIONAL_CONSUMER_PATHS,COMPLETE_FUNCTIONAL_CONSUMER_RECORD],sha='86eb1204ba553088dd71091e44ee7676d253c3ba';
 const overlay=p=>paths.includes(p)?historical(sha,p):current(p);
 const view=calendarPiPredecessor(overlay,historical);assert(view.complete.consumer);
 for(const p of paths){assert(Object.hasOwn(view.sourceDigests,p));assert.throws(()=>calendarPiPredecessor(f=>f===p?Buffer.concat([overlay(f),Buffer.from('UNACCEPTED')]):overlay(f),historical),p);}
});
