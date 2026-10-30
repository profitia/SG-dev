import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const manifest=JSON.parse(read('../deployment/financial-document-statement-2026-10-31.json'));
const sql=read('../db/private-store/'+manifest.migration);
const hash=value=>createHash('sha256').update(value).digest('hex');
const q=value=>"'"+value.replaceAll("'","''")+"'";
const json=value=>q(JSON.stringify(value))+'::jsonb';
const policiesSql="SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='srm' AND tablename='financial_source_documents'";
const ownerFence="current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.financial_source_documents'::regclass AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)";
/** Policy-only portion of an independently authorized, exact-target release.
 * The outer canonical transaction must verify Neon/installation/runtime identity,
 * preserve original membership and budgets, and revoke temporary ownership before
 * COMMIT. This helper grants nothing, executes nothing and never commits. */
export async function captureFinancialDocumentPolicies(client){
 const policies=(await client.query('SELECT ('+policiesSql+') policies')).rows[0]?.policies;
 return {target:'MAIN_SRM_DEVELOPMENT',policies};
}
export function documentStatementPolicyPlan({mode,backup}){
 assert(['install','restore'].includes(mode),'Known policy plan required');
 assert.deepEqual(Object.keys(backup??{}).sort(),['policies','target']);
 assert.equal(backup.target,'MAIN_SRM_DEVELOPMENT');
 assert.deepEqual(backup.policies,manifest.originalPolicies,'Exact original complete policy backup required');
 assert.equal(hash(sql),manifest.migrationSha256,'Exact reviewed migration bytes required');
 if(mode==='install')return {target:backup.target,mode,statements:[`DO $baseline$ BEGIN IF ${ownerFence} OR (${policiesSql}) IS DISTINCT FROM ${json(backup.policies)} THEN RAISE EXCEPTION 'Exact main document policy backup required' USING ERRCODE='42501';END IF;END $baseline$`,sql]};
 const originals=manifest.originalPolicies;
 const expected=originals.map(({qual,with_check,...p})=>({...p,expression_md5:manifest.installedPolicyMd5[p.policyname]??createHash('md5').update((qual??'')+'\n'+(with_check??'')).digest('hex')}));
 const actual="SELECT jsonb_agg((to_jsonb(p)-'qual'-'with_check')||jsonb_build_object('expression_md5',md5(coalesce(p.qual,'')||E'\\n'||coalesce(p.with_check,''))) ORDER BY policyname) FROM pg_policies p WHERE schemaname='srm' AND tablename='financial_source_documents'";
 const statements=[`DO $restore_fence$ BEGIN IF ${ownerFence} OR (${actual}) IS DISTINCT FROM ${json(expected)} THEN RAISE EXCEPTION 'Exact installed document policies required for recovery' USING ERRCODE='42501';END IF;END $restore_fence$`];
 for(const p of originals.filter(p=>manifest.policies.includes(p.policyname))){
  const ident='"'+p.policyname.replaceAll('"','""')+'"';
  statements.push('ALTER POLICY '+ident+' ON srm.financial_source_documents'+(p.qual?' USING ('+p.qual+')':'')+(p.with_check?' WITH CHECK ('+p.with_check+')':''));
 }
 statements.push(`DO $restored$ BEGIN IF (${policiesSql}) IS DISTINCT FROM ${json(originals)} THEN RAISE EXCEPTION 'Complete original document policy recovery required' USING ERRCODE='42501';END IF;END $restored$`);
 return {target:backup.target,mode,statements};
}
