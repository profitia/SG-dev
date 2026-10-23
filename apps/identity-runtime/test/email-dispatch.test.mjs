import test from 'node:test';
import assert from 'node:assert/strict';
import {createSandboxDispatcher} from '../dist/src/email-dispatch.js';
import {renderSandboxSample,catalog} from '../email-templates/render.mjs';
const render=avatar=>renderSandboxSample(avatar,'2026-10-23T22:00:00.000Z');
const accepted={status:'accepted',providerId:'<sample@domain.example>'};

test('parallel male/female requests retain their own avatar and recipient',async()=>{
  const messages=[];const dispatch=createSandboxDispatcher(async message=>{messages.push(message);return accepted;},render);
  await Promise.all(['male','female'].map(avatar=>dispatch({sampleId:'sample-'+avatar,recipient:avatar+'@example.com',avatar})));
  assert.equal(messages.length,2);
  for(const avatar of ['male','female']) {
    const message=messages.find(m=>m.recipient===avatar+'@example.com');
    assert.ok(message.html.includes(catalog.assets[avatar]));
    assert.ok(!message.html.includes(catalog.assets[avatar==='male'?'female':'male']));
    assert.match(message.text,/kod 000000 jest przykładem/);
  }
});

test('concurrent duplicate samples share one submission; conflicting payloads fail closed',async()=>{
  let calls=0;const dispatch=createSandboxDispatcher(async()=>{calls++;return accepted;},render);
  const sample={sampleId:'sample-0001',recipient:'one@example.com',avatar:'male'};
  const [a,b]=await Promise.all([dispatch(sample),dispatch(sample)]);
  assert.deepEqual(a,b);assert.equal(calls,1);
  await assert.rejects(()=>dispatch({...sample,avatar:'female'}),/already bound/);
  await assert.rejects(()=>dispatch({...sample,recipient:'two@example.com'}),/already bound/);
  assert.equal(calls,1);
});

test('unconfirmed and rejected samples never auto-resend within the batch',async()=>{
  for(const submission of [{status:'unknown',code:'submission_unconfirmed'},{status:'rejected',code:'provider_rejected'}]) {
    let calls=0;const dispatch=createSandboxDispatcher(async()=>{calls++;return submission;},render);
    const input={sampleId:'sample-0002',recipient:'one@example.com',avatar:null};
    assert.equal((await dispatch(input)).avatar,'neutral');await dispatch(input);assert.equal(calls,1);
  }
});

test('batch is bounded and does not evict duplicate protection silently',async()=>{
  let calls=0;const dispatch=createSandboxDispatcher(async()=>{calls++;return accepted;},render);
  for(let i=0;i<100;i++) await dispatch({sampleId:'sample-'+String(i).padStart(4,'0'),recipient:'one@example.com',avatar:'male'});
  await assert.rejects(()=>dispatch({sampleId:'sample-0100',recipient:'one@example.com',avatar:'male'}),/limit/);
  assert.equal(calls,100);
});
