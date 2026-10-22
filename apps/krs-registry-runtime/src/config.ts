import {RegistryError} from './errors.js'
export function loadConfig(env:NodeJS.ProcessEnv=process.env){
  // No physical catalog topology or E1 producer receipt has been accepted yet.
  if(['KRS_EXTERNAL_ENABLED','KRS_SYNC_ENABLED','KRS_CONSUMER_ENABLED'].some(k=>env[k]!==undefined&&!['false','0'].includes(env[k]!)))throw new RegistryError('ACTIVATION_DEFERRED')
  if(env.KRS_DATABASE_URL)throw new RegistryError('CATALOG_STORAGE_BINDING_NOT_ACCEPTED')
  const port=Number(env.PORT??3501);if(!Number.isInteger(port)||port<1024||port>65535)throw new RegistryError('INVALID_PORT')
  return Object.freeze({port,externalEnabled:false,syncEnabled:false,consumerEnabled:false,scheduled:false,environment:'development',binding:'UNCONFIGURED'})
}
/** Test harness accepts only its finite synthetic database, never PMOS/Neon or cloud credentials. */
export function isolatedDatabaseUrl(input:string,role:'krs_reader'|'krs_ingest'|'krs_migrator'|'krs_test_owner'):string{
  const u=new URL(input)
  if(!['postgres:','postgresql:'].includes(u.protocol)||!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname!=='/krs_registry_test'||u.username!==role||u.search||u.hash)throw new RegistryError('ISOLATED_DATABASE_REQUIRED')
  return u.href
}
