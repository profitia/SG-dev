import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import pg from 'pg'
const hash=v=>createHash('sha256').update(v).digest('hex')
const migration=()=>fs.readFileSync(new URL('../db/private-store/027-rural-location-geocoding.sql',import.meta.url),'utf8')
export const ruralLocationFunctions=Object.freeze([
 'srm.location_sync_write(uuid,uuid,bigint,uuid,text,text,jsonb)',
 'srm.location_installation_descriptor()',
])
const previous=['57578f92d59197e8b677813e9ac872a1','2de9ffe414a087d3af6bb671eaa1c8a6']
const adopted=['0a6c57f8b287735493c80e88ed53abec','df1f69b58ee069758d85f80ee55a6e3b']
export async function readRuralLocationBackup(client){
 const rows=[]
 for(const signature of ruralLocationFunctions){
  const row=(await client.query('SELECT pg_get_functiondef(oid) definition,md5(prosrc) body_md5 FROM pg_proc WHERE oid=$1::regprocedure AND proowner=\'profitia_access_owner\'::regrole AND prosecdef',[signature])).rows[0]
  if(!row)throw Error('Exact controlled function required')
  rows.push({signature,...row})
 }
 return {target:'MAIN_SRM_DEVELOPMENT',functions:rows}
}
export async function releaseRuralLocations(client,{backup,apply=false,restore=false}={}){
 if(backup?.target!=='MAIN_SRM_DEVELOPMENT'||backup.functions?.length!==2
  ||backup.functions.some((r,i)=>r.signature!==ruralLocationFunctions[i]||r.body_md5!==previous[i]||typeof r.definition!=='string'))throw Error('Verified original function backup required')
 await client.query('BEGIN')
 try{
  await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';SELECT pg_advisory_xact_lock(20261029,27)")
  const check=(await client.query("SELECT current_database()='platform_private' AND session_user='neondb_owner' AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=session_user::regrole AND roleid IN('profitia_access_owner'::regrole,'profitia_ingestion_owner'::regrole) AND(set_option OR inherit_option)) AS allowed")).rows[0]
  if(check?.allowed!==true)throw Error('Exact ordinary main Development operator precondition required')
  const current=await readRuralLocationBackup(client)
  if(!restore&&JSON.stringify(current)!==JSON.stringify(backup))throw Error('Function definitions changed after backup')
  if(restore&&current.functions.some((r,i)=>r.body_md5!==adopted[i]))throw Error('Exact installed rural projection required')
  await client.query('GRANT profitia_access_owner TO neondb_owner WITH ADMIN FALSE, INHERIT FALSE, SET TRUE')
  await client.query('SET LOCAL ROLE profitia_access_owner')
  if(restore){for(const row of backup.functions)await client.query(row.definition)}else await client.query(migration())
  await client.query('RESET ROLE')
  await client.query('REVOKE profitia_access_owner FROM neondb_owner GRANTED BY neondb_owner')
  const clean=(await client.query("SELECT NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=session_user::regrole AND roleid IN('profitia_access_owner'::regrole,'profitia_ingestion_owner'::regrole) AND(set_option OR inherit_option OR grantor=session_user::regrole)) AS clean, (SELECT count(*) FROM pg_auth_members WHERE member=session_user::regrole AND grantor='cloud_admin'::regrole AND roleid IN('profitia_access_owner'::regrole,'profitia_ingestion_owner'::regrole) AND admin_option AND NOT set_option AND NOT inherit_option) AS retained_admin")).rows[0]
  if(clean?.clean!==true||Number(clean.retained_admin)!==2)throw Error('Temporary administration cleanup failed')
  const installed=await readRuralLocationBackup(client)
  if(installed.functions.some((r,i)=>r.body_md5!==(restore?previous:adopted)[i]))throw Error('Exact function adoption or restoration failed')
  await client.query(apply?'COMMIT':'ROLLBACK')
  return {applied:apply,mode:restore?'RESTORE':'INSTALL',migrationSha256:hash(migration()),temporaryAdministrationRemoved:true,retainedAdminRoutes:2,historyDeleted:false,paidPoliciesChanged:false,functions:installed.functions.map(({signature,body_md5})=>({signature,body_md5}))}
 }catch(error){await client.query('ROLLBACK');throw error}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2)
 if(args.some((v,i)=>!['--plan','--backup','--backup-sha256','--apply','--restore'].includes(v)&&!['--backup','--backup-sha256'].includes(args[i-1])))throw Error('Unknown release option')
 if(args.includes('--plan')){console.log(JSON.stringify({target:'MAIN_SRM_DEVELOPMENT',functions:ruralLocationFunctions,migrationSha256:hash(migration()),dataOrRolesChanged:false}));process.exit(0)}
 const value=key=>args[args.indexOf(key)+1],url=new URL(process.env.SRM_READY_RELEASE_DIRECT_URL??'')
 if(process.env.TARGET_ENVIRONMENT!=='development'||url.hostname!=='ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech'||url.username!=='neondb_owner'||url.pathname!=='/platform_private'||url.searchParams.get('sslmode')!=='require')throw Error('Exact registered direct Development connection required')
 const path=value('--backup'),expected=value('--backup-sha256')
 if(!args.includes('--backup')||!args.includes('--backup-sha256')||!path||hash(fs.readFileSync(path))!==expected)throw Error('Verified existing backup file required')
 const client=new pg.Client({connectionString:url.toString()});await client.connect()
 try{console.log(JSON.stringify(await releaseRuralLocations(client,{backup:JSON.parse(fs.readFileSync(path,'utf8')),apply:args.includes('--apply'),restore:args.includes('--restore')})))}finally{await client.end()}
}
