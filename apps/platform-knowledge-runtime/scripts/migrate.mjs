import fs from 'node:fs/promises';
import pg from 'pg';
import {createHash} from 'node:crypto';
// No credential output, no automatic rollback via destructive SQL.
if(process.env.PK_ENVIRONMENT!=='development')throw Error('DEVELOPMENT_REQUIRED');
const uri=new URL(process.env.PK_MIGRATOR_DATABASE_URL??'');
if(decodeURIComponent(uri.username)!=='platform_knowledge_migrator'||uri.pathname!=='/platform_knowledge'
 ||uri.hostname!=='ep-wild-mode-b972j8k0.c-7.eu-central-1.aws.neon.tech'||uri.searchParams.get('sslmode')!=='verify-full')throw Error('MIGRATOR_BINDING_REJECTED');
const sql=await fs.readFile(new URL('../db/migrations/001-knowledge.sql',import.meta.url),'utf8');
const sha256=createHash('sha256').update(sql).digest('hex');
if(process.env.PK_APPROVED_MIGRATION_SHA256!==sha256)throw Error('EXACT_MIGRATION_REVIEW_REQUIRED');
const client=new pg.Client({connectionString:uri.href,connectionTimeoutMillis:10000,statement_timeout:30000});
try{
 await client.connect();await client.query('BEGIN; SET LOCAL ROLE platform_knowledge_owner');
 const existing=await client.query("SELECT to_regclass('platform_knowledge.schema_version') AS present");
 if(existing.rows[0].present)throw Error('MIGRATION_ALREADY_PRESENT_VERIFY_INSTEAD');
 await client.query(sql);await client.query('COMMIT');
 process.stdout.write(JSON.stringify({status:'INSTALLED',version:1,sha256})+'\n');
}catch(error){await client.query('ROLLBACK').catch(()=>{});process.stderr.write('MIGRATION_FAILED\n');process.exitCode=1;}
finally{await client.end().catch(()=>{});}
