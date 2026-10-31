import assert from 'node:assert/strict'
import test from 'node:test'
import {locationCacheReleasePlan} from './location-cache-release.mjs'
const input={targetEnvironment:'development',serviceId:'srv-db1vu6gm7kps73d0e3r0',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',sourceSha:'a'.repeat(40)}
test('location cache cloud proposal has one limited retention login, no new location table and an expiry-preserving rollback',()=>{
 const p=locationCacheReleasePlan(input)
 assert.equal(p.reviewOnly,true);assert.equal(p.paidProviderCalls,0);assert.equal(p.ordinaryMaintenanceRole.connectionLimit,1)
 assert.equal(p.ordinaryMaintenanceRole.ownerMemberships,0);assert.equal(p.ordinaryMaintenanceRole.tablePrivileges,0)
 assert.equal(p.scheduler.googleKey,false);assert.equal(p.scheduler.mgbiKey,false);assert.equal(p.scheduler.maximumConcurrentRuns,1)
 assert.equal(p.rollback.keepPurgeScheduleUntilNoGoogleCoordinatesRemain,true);assert.equal(p.rollback.dropTablesOrHistory,false)
 assert(!p.receiverSql.includes('CREATE TABLE srm.supplier_locations'));assert(!p.receiverSql.includes('CREATE ROLE'))
 assert(p.ownerControlledSql.every(s=>!s.includes('GRANT ALL')&&!s.includes('GRANT SELECT')&&!s.includes('GRANT UPDATE')))
 for(const patch of [{targetEnvironment:'staging'},{targetEnvironment:'production'},{serviceId:'pilot'},{projectId:'other'},{branchId:'other'},{databaseName:'neondb'},{sourceSha:'unverified'}])
  assert.throws(()=>locationCacheReleasePlan({...input,...patch}))
})
