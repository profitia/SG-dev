import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {postgresFixture} from './fixtures/identity-profile-postgres.mjs';
import {vocativeDictionary,nameKey,installVocativeDictionary,vocativeSchemaDigest} from '../src/vocative-dictionary.mjs';
test('versioned user source is complete; only explicit reviewed Polish entries can be active',()=>{
 const d=vocativeDictionary();assert.equal(d.sourceDigest,'fdea48c80c48b401b6d9613636c877d1ae46081699530017fa3ed586c7f38620');assert.equal(d.rows.length,24708);assert.equal(d.entries.length,259);
 const find=n=>d.entries.find(r=>r.key===nameKey(n));
 assert.equal(find('Marek').vocative,'Marku');assert.equal(find('Tomasz').vocative,'Tomaszu');assert.equal(find('Anna').gender,'Female');
 assert.equal(find('Franciszek').vocative,'Franciszku');assert.equal(find('Antoni').vocative,'Antoni');
 for(const n of ['John','Alex','Andrea','Mrs.','Kuba,','Anna Maria'])assert.equal(find(n),undefined);
 assert(d.rows.some(r=>r.name==='John'&&r.vocative==='Joho'));
 assert.equal(nameKey(' JÓZEF '),nameKey('Józef'));assert.notEqual(nameKey('Lukasz'),nameKey('Łukasz'));
 assert.equal(new Set(d.entries.map(r=>r.key)).size,d.entries.length);
});

test('SQL006 installs under controlled owner, defaults closed and persists only reviewed PL forms', {timeout:60000}, async t=>{
 const f=await postgresFixture();t.after(()=>f.close());
 const read=n=>fs.readFileSync(new URL('../migrations/profile/'+n+'.sql',import.meta.url),'utf8');
 const digest=s=>createHash('sha256').update(s).digest('hex');
 await f.admin.query('BEGIN');
 for(const [file,table] of [['003-email-delivery','email'],['004-communication-language','language'],['005-registration','registration']]) {
  const sql=read(file);await f.admin.query(sql);
  await f.admin.query('INSERT INTO profitia_profile.'+table+'_installation VALUES(true,$1)',[digest(sql)]);
 }
 await f.admin.query(`INSERT INTO profitia_profile.email_policies(login_role,issuer,instance_id,service_id,enabled,allow_avatar_projection,allow_language_projection,proof_key)
 VALUES('identity_b1_runtime','https://synthetic.clerk.accounts.dev','ins_test1234','identity-email-test',true,true,true,$1)`,[f.proofKey]);
 await f.admin.query(read('006-vocative'));
 const manifest=await installVocativeDictionary(f.admin.query.bind(f.admin));
 assert.equal(manifest.sourceRows,24708);assert.equal(manifest.approvedNames,259);
 assert.equal(manifest.schemaDigest,vocativeSchemaDigest());
 await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.email_descriptor(),profitia_profile.vocative_descriptor() TO identity_b1_runtime');
 await f.admin.query('COMMIT');
 let descriptor=(await f.pool.query('SELECT profitia_profile.vocative_descriptor() AS d')).rows[0].d;
 assert.equal(descriptor.salutationEnabled,false);assert.equal(descriptor.dictionaryDigest,vocativeDictionary().reviewDigest);
 for(const [name,language,expected] of [['Marek','pl','Marku'],['Anna','pl','Anno'],['Marek','en',null],['John','pl',null],['Anna Maria','pl',null]]) {
  const value=(await f.admin.query('SELECT profitia_profile.resolve_vocative($1,$2) AS r',[name,language])).rows[0].r;
  assert.equal(value.vocative,expected);if(expected===null)assert.equal(value.gender,'Unknown');
 }
 for(const table of ['vocative_source','vocative_dictionary','vocative_installation'])await assert.rejects(f.pool.query('SELECT * FROM profitia_profile.'+table),e=>e.code==='42501');
 await assert.rejects(f.pool.query("SELECT profitia_profile.resolve_vocative('Marek','pl')"),e=>e.code==='42501');
 const policies=(await f.admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('vocative_source','vocative_dictionary','vocative_installation')")).rows;
 assert.equal(policies.length,3);assert(policies.every(p=>p.relrowsecurity&&p.relforcerowsecurity));
 await f.admin.query('UPDATE profitia_profile.email_policies SET allow_salutation_projection=true');
 descriptor=(await f.pool.query('SELECT profitia_profile.vocative_descriptor() AS d')).rows[0].d;assert.equal(descriptor.salutationEnabled,true);
});
