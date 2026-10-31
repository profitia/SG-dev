import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {LOCATION_CACHE_MAINTENANCE_ROLE as role} from './location-cache-maintenance.mjs'
const migration=fs.readFileSync(new URL('../db/private-store/033-location-geocoding-cache.sql',import.meta.url),'utf8')
const acceptance=JSON.parse(fs.readFileSync(new URL('../deployment/supplier-location-cache-2026-10-31.json',import.meta.url),'utf8'))
const q=s=>"'"+s.replaceAll("'","''")+"'"
/** Review-only deterministic plan. It cannot connect, create a role/password,
 * install SQL, change Render, or call a paid provider. Cloud execution needs
 * separate owner acceptance, a verified LKG and a fresh guarded transaction. */
export function locationCacheReleasePlan({targetEnvironment,serviceId,projectId,branchId,databaseName,sourceSha}){
 if(targetEnvironment!=='development'||serviceId!=='srv-db1vu6gm7kps73d0e3r0'||projectId!=='spring-bread-28217539'
  ||branchId!=='br-sparkling-term-b99l107x'||databaseName!=='platform_private'||!/^[a-f0-9]{40}$/.test(sourceSha))throw Error('Exact main Development release required')
 const digest=createHash('sha256').update(migration).digest('hex')
 if(digest!==acceptance.schemaDigest||acceptance.cacheDays!==29||acceptance.hardLicenceLimitDays!==30)throw Error('Pinned cache receiver required')
 return Object.freeze({reviewOnly:true,sourceSha,migrationDigest:digest,
  prerequisites:['OWNER_APPROVAL_FOR_CLOUD_ROLE_SQL_ACL_AND_CRON_COST','EXACT_MAIN_CI','FRESH_LIVE_BASELINE_AND_MEMBERSHIP_FENCE','VERIFIED_RETAINED_LKG','VERIFIED_DATABASE_RECOVERY_POINT'],
  receiverSql:migration,
  ownerControlledSql:[
   `INSERT INTO srm.location_cache_installation VALUES(true,'1.0.0',${q(digest)},${q(sourceSha)})`,
   `GRANT CONNECT ON DATABASE platform_private TO ${role}`,
   `GRANT USAGE ON SCHEMA srm TO ${role}`,
   `GRANT EXECUTE ON FUNCTION srm.location_cache_maintain() TO ${role}`,
   'GRANT EXECUTE ON FUNCTION srm.location_cache_descriptor() TO srm_private_development_runtime,srm_private_development_jobs',
   'GRANT EXECUTE ON FUNCTION srm.location_cache_read(uuid,uuid,uuid),srm.location_sync_matches(uuid,uuid,jsonb) TO srm_private_development_runtime',
  ],
  ordinaryMaintenanceRole:{name:role,login:true,inherit:false,superuser:false,bypassRls:false,createDb:false,createRole:false,replication:false,connectionLimit:1,ownerMemberships:0,tablePrivileges:0},
  scheduler:{name:'srm-location-cache-development-maintenance',type:'cron_job',schedule:'17 * * * *',region:'frankfurt',
   startCommand:'node apps/srm/scripts/location-cache-maintenance.mjs',maximumConcurrentRuns:1,queryTimeoutMs:10000,
   secrets:['SRM_LOCATION_CACHE_MAINTENANCE_URL'],googleKey:false,clerkKey:false,mgbiKey:false,minimumUsdPerMonth:1,usageAndDatabaseWakeCostAdditional:true},
  activation:{afterFirstSuccessfulSweep:true,env:{PROFITIA_SUPPLIER_LOCATION_GEOCODING_VERSION:'srm-google-geocoding-cache-v1'}},
  rollback:{runtimeMode:'srm-google-geocoding-transient-v1',preserveOrganisationLocations:true,preserveSourceHistory:true,
   keepPurgeScheduleUntilNoGoogleCoordinatesRemain:true,dropTablesOrHistory:false},
  paidProviderCalls:0,excludedEnvironmentChanges:false,
 })
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 if(process.argv.length!==3)throw Error('One review input file required')
 console.log(JSON.stringify(locationCacheReleasePlan(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),null,2))
}
