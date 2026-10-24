import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAssistantAvatar} from '../dist/src/email-avatar.js';
import {normalizeAvatar} from '../email-templates/render.mjs';
test('appearance is a closed enum, never inferred from identity or arbitrary metadata',()=>{
  for(const value of [null,undefined,{},true,false,'MALE','Female','Tomasz','male@example.com','male\n','female" onerror="x']) {
    assert.equal(normalizeAssistantAvatar(value),'neutral');
    assert.equal(normalizeAvatar(value),'neutral');
  }
  for(const value of ['male','female']) assert.equal(normalizeAssistantAvatar(value),value);
});
