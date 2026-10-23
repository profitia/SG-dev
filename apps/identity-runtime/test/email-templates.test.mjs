import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {catalog, normalizeAvatar, renderHtml, renderRevolvapp, renderPlain, renderConditionalRevolvapp, exportBundle} from '../email-templates/render.mjs';

test('unknown and missing preferences are neutral, never inferred as male', () => {
  for (const value of [null,undefined,'','Male','FEMALE',true,{},'javascript:alert(1)','female" onerror="x']) assert.equal(normalizeAvatar(value),'neutral');
  assert.equal(normalizeAvatar('male'),'male'); assert.equal(normalizeAvatar('female'),'female');
});

for (const kind of Object.keys(catalog.messages)) for (const avatar of ['male','female','neutral']) test(`${kind}/${avatar}: preserve provider variables and correct artwork`, () => {
  for (const render of [renderHtml, renderRevolvapp, renderPlain]) {
    const out=render(kind,avatar);
    assert.match(out,/\{\{app\.name\}\}/); assert.match(out,/\{\{current_year\}\}/);
    assert.match(out,/Profitia Management Consultants/); assert.match(out,/Puławska 145/);
    assert.doesNotMatch(out,/481926|123456|424242|Wersja testowa|Supplier Relationship Management|Twój doradca|<script|<iframe|onerror=/i);
    if(kind==='invitation') { assert.match(out,/\{\{action_url\}\}/); assert.match(out,/\{\{invitation.expires_in_days\}\}/); assert.doesNotMatch(out,/otp_code/); }
    else { assert.match(out,/\{\{otp_code\}\}/); assert.match(out,/\{\{requested_from\}\}/); assert.match(out,/\{\{requested_at\}\}/); assert.doesNotMatch(out,/action_url/); }
  }
  const html=renderHtml(kind,avatar);
  for(const gender of ['male','female']) assert.equal(html.includes(catalog.assets[gender]),gender===avatar);
  if(kind==='invitation') assert.equal((html.match(/href="\{\{action_url\}\}"/g)||[]).length,2);
});

test('female voice follows assistant appearance, neutral does not infer a gender',()=>{
  assert.match(renderPlain('verify-email','female'),/Przygotowałam/);
  assert.match(renderPlain('verify-email','male'),/Przygotowałem/);
  assert.doesNotMatch(renderPlain('verify-email','neutral'),/Przygotowa[łl]/);
});

test('unrecognized message/variant and process-specific conditional routing fail closed',()=>{
  assert.throws(()=>renderHtml('reset-password','male'));
  assert.throws(()=>renderHtml('invitation','unknown'));
  assert.throws(()=>renderConditionalRevolvapp('sign-up'));
});

test('conditional candidates use public metadata and only built-in if/else',()=>{
  const otp=renderConditionalRevolvapp('verification-code'), invitation=renderConditionalRevolvapp('invitation');
  assert.match(otp,/user.public_metadata.assistantAvatar.isFemale/);
  assert.match(invitation,/invitation.public_metadata.assistantAvatar.isMale/);
  assert.doesNotMatch(otp+invitation,/unsafe_metadata|sign_up\.|#eq|\{\{\{/);
});

test('assets are pinned public HTTPS paths, not data/credential links',()=>{
  for(const asset of Object.values(catalog.assets)){
    const url=new URL(asset); assert.equal(url.protocol,'https:'); assert.equal(url.hostname,'storage.googleapis.com');
    assert.match(url.pathname,/\/[a-f0-9]{64}\.png$/); assert.equal(url.search,'');
  }
});

test('bundle has all 15 variants and cannot replace existing reviewed directory',()=>{
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'identity-email-test-'));
  try {
    const out=path.join(parent,'bundle'); assert.equal(exportBundle(out).length,15);
    assert.equal(fs.readdirSync(out).length,64);
    assert.throws(()=>exportBundle(out),/EEXIST/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'manifest.json'))).conditionalStatus,'LOCAL_CANDIDATE_REQUIRES_CLERK_CONTEXT_ACCEPTANCE');
  } finally {fs.rmSync(parent,{recursive:true,force:true});}
});
