import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {documentStatementPolicyPlan} from './financial-document-statement-release.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../deployment/financial-document-statement-2026-10-31.json',import.meta.url)));
const backup=()=>({target:'MAIN_SRM_DEVELOPMENT',policies:structuredClone(manifest.originalPolicies)});
test('a complete original policy backup is required before producing install or restore statements',()=>{
 for(const mode of ['install','restore'])for(const alter of [b=>b.policies.pop(),b=>b.policies.push(b.policies[0]),b=>b.target='STAGING',b=>b.policies[0].roles=['public'],b=>b.policies[0].qual='false',b=>b.extra=true]){
  const value=backup();alter(value);assert.throws(()=>documentStatementPolicyPlan({mode,backup:value}));
 }
});
test('recovery retains all previous roles, restrictions and expressions; no plan grants authority or commits',()=>{
 const original=backup();
 for(const mode of ['install','restore']){
  const plan=documentStatementPolicyPlan({mode,backup:original});assert.deepEqual(original,backup());
  assert.equal(plan.target,'MAIN_SRM_DEVELOPMENT');
  assert(plan.statements.every(sql=>!/(?:^|;)\s*(?:GRANT|COMMIT|TRUNCATE|DROP|DELETE)\b/i.test(sql)));
  assert(plan.statements.every(sql=>!sql.includes('DISABLE ROW LEVEL SECURITY')));
  if(mode==='restore'){assert.equal(plan.statements.filter(sql=>sql.startsWith('ALTER POLICY')).length,5);assert(plan.statements[0].includes('Exact installed document policies'));assert(plan.statements.at(-1).includes('Complete original document policy recovery'));}
 }
});
