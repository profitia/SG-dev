import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import pg from 'pg'
import {loadConfiguration} from '../src/config.mjs'
import {curate} from '../src/semantics.mjs'
export async function applyCuration(client,changes){
 if(!Array.isArray(changes)||changes.length>1000)throw Error('BOUNDED_CURATION_INPUT_REQUIRED')
 await client.query('BEGIN')
 try{
  const {rows:[r]}=await client.query('SELECT current_user AS role,session_user AS login')
  if(r.role!=='economic_calendar_development_migrator'||r.login!==r.role)throw Error('CONTROLLED_MIGRATOR_REQUIRED')
  await client.query('SET LOCAL ROLE economic_calendar_development_owner')
  const results=[];for(const change of changes)results.push(await curate(client,change))
  await client.query('COMMIT');return {applied:results.length,changed:results.filter(r=>r.changed).length,results}
 }catch(e){await client.query('ROLLBACK');throw e}
}
async function main(){
 const c=loadConfiguration(process.env,'migrator'),file=process.env.ECR_CURATION_FILE
 if(!file)throw Error('EXACT_CURATION_FILE_REQUIRED')
 const bytes=await readFile(file);if(bytes.length>1048576)throw Error('CURATION_TOO_LARGE')
 const u=new URL(c.connectionString);u.searchParams.delete('sslmode');u.searchParams.delete('channel_binding')
 const client=new pg.Client({connectionString:u.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true});await client.connect()
 try{console.log(JSON.stringify(await applyCuration(client,JSON.parse(bytes.toString()))))}finally{await client.end()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('{"error":"CURATION_REFUSED"}');process.exitCode=1})
