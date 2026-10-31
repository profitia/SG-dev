import {pathToFileURL} from 'node:url'
import pg from 'pg'
export const LOCATION_CACHE_MAINTENANCE_ROLE='srm_location_cache_development_maintenance'
export function locationCacheMaintenanceConfiguration(env){
 const raw=env.SRM_LOCATION_CACHE_MAINTENANCE_URL
 if(env.TARGET_ENVIRONMENT!=='development'||env.SRM_LOCATION_CACHE_MAINTENANCE_VERSION!=='srm-location-cache-maintenance-v1'
  ||typeof raw!=='string')throw Error('Explicit main Development cache maintenance required')
 const u=new URL(raw)
 if(decodeURIComponent(u.username)!==LOCATION_CACHE_MAINTENANCE_ROLE||u.pathname!=='/platform_private'
  ||u.hostname!=='ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech'
  ||u.searchParams.get('sslmode')!=='require'||u.searchParams.get('channel_binding')!=='require'||!u.password)throw Error('Exact limited main Development database connection required')
 return Object.freeze({connectionString:raw,connectionTimeoutMillis:5000,query_timeout:10000})
}
/** One non-public scheduled command, no HTTP listener, retries or provider key.
 * SQL admits only the dedicated ordinary operator and returns counts only. */
export async function runLocationCacheMaintenance(client){
 let transaction=false
 try{
  await client.query('BEGIN');transaction=true
  await client.query("SET LOCAL lock_timeout='2s'")
  await client.query("SET LOCAL statement_timeout='8s'")
  const identity=(await client.query('SELECT session_user::text role,current_database() database_name')).rows[0]
  if(identity?.role!==LOCATION_CACHE_MAINTENANCE_ROLE||identity.database_name!=='platform_private')throw Error('Cache maintenance database identity mismatch')
  const result=(await client.query('SELECT srm.location_cache_maintain() AS result')).rows[0]?.result
  if(result?.completed!==true||!Number.isSafeInteger(result.expiredCoordinates)||result.expiredCoordinates<0
   ||Object.keys(result).sort().join(',')!=='completed,expiredCoordinates')throw Error('Invalid cache maintenance receipt')
  await client.query('COMMIT');transaction=false
  return Object.freeze({...result})
 }catch(error){if(transaction)await client.query('ROLLBACK').catch(()=>{});throw error}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let client
 try{
  const config=locationCacheMaintenanceConfiguration(process.env)
  client=new pg.Client(config);await client.connect()
  const result=await runLocationCacheMaintenance(client)
  console.info(JSON.stringify({event:'srm_location_cache_maintenance',environment:'development',...result}))
 }catch{
  // Never print a URL, password, SQL value, location, provider data or raw error.
  console.error(JSON.stringify({event:'srm_location_cache_maintenance',environment:'development',status:'FAILED'}))
  process.exitCode=1
 }finally{await client?.end()}
}

