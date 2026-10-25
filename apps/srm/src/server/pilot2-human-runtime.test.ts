import test from 'node:test'
import assert from 'node:assert/strict'
import {pilot2HumanConnection,readPilot2HumanConfiguration} from './pilot2-human-runtime'
const privateHost='ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech'
const publicHost='ep-fragrant-cloud-b1y6i4v8.c-5.eu-central-1.aws.neon.tech'
const origin='https://srm-krs-pilot2-development.onrender.com'
const url=(host:string,db:string,role:string)=>`postgresql://${role}:fixture@${host}/${db}?sslmode=require&channel_binding=require`
function environment(){return {
 TARGET_ENVIRONMENT:'development',RENDER_SERVICE_ID:'srv-dbeh6srrjlhs73fmikrg',RENDER_GIT_COMMIT:'a'.repeat(40),
 PROFITIA_AUTH_PROVIDER:'clerk',SRM_PILOT2_FORM_ADMISSION:'true',PROFITIA_FIXED_ORGANISATION_ID:'11111111-1111-4111-8111-111111111111',
 PROFITIA_CLERK_ISSUER:'https://fixture.clerk.accounts.dev',PROFITIA_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from('fixture.clerk.accounts.dev$').toString('base64url'),
 PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',PROFITIA_CLERK_AUTHORIZED_PARTIES:JSON.stringify([origin]),
 PILOT2_E1_DATABASE_URL:url(privateHost,'platform_private','srm_private_development_runtime'),
 PILOT2_E1_JOBS_URL:url(privateHost,'platform_private','srm_pilot2_jobs'),
 PILOT2_PUBLIC_CATALOG_URL:url(publicHost,'srm_app','srm_pilot2_catalog_reader'),
}}
test('only PILOT2 roles and exact separate authority/public destinations retain strict TLS',()=>{
 for(const [role,host,db]of [['srm_private_development_runtime',privateHost,'platform_private'],['srm_pilot2_jobs',privateHost,'platform_private'],['srm_pilot2_catalog_reader',publicHost,'srm_app']]as const){
  const configuration=pilot2HumanConnection(url(host,db,role),role)
  assert.equal(configuration.ssl.rejectUnauthorized,true);assert.equal(configuration.user,role)
  for(const changed of [url(host,db,role).replace('sslmode=require','sslmode=disable'),url(host,db,role)+'&options=role%3Downer',url(host,db,role).replace(':fixture@',':fixture@other-'),url(host,'other_db',role),url(host,db,'neondb_owner')])assert.throws(()=>pilot2HumanConnection(changed,role))
 }
 assert.throws(()=>pilot2HumanConnection(url(privateHost,'platform_private','neondb_owner'),'neondb_owner' as never))
 assert.throws(()=>pilot2HumanConnection(url(privateHost,'platform_private','srm_pilot2_catalog_reader'),'srm_pilot2_catalog_reader'))
})
test('explicit Clerk stage requires its accepted service, sole public origin and server organisation',()=>{
 const env=environment(),c=readPilot2HumanConfiguration(env)
 assert.equal(c.config.application.deploymentId,env.RENDER_SERVICE_ID+':'+env.RENDER_GIT_COMMIT)
 assert.equal(c.config.binding.databaseName,'platform_private');assert.equal(c.catalog.database,'srm_app')
 assert.equal(c.config.application.organisationId,env.PROFITIA_FIXED_ORGANISATION_ID)
 for(const patch of [{TARGET_ENVIRONMENT:'staging'},{PROFITIA_AUTH_PROVIDER:'legacy_demo'},{SRM_PILOT2_FORM_ADMISSION:'false'},
  {RENDER_SERVICE_ID:'srv-dbd5hlcipgvc73d98ukg'},{RENDER_GIT_COMMIT:'main'},
  {PROFITIA_FIXED_ORGANISATION_ID:'client-selected'},
  {PROFITIA_CLERK_AUTHORIZED_PARTIES:JSON.stringify(['https://srm-staging-runtime.onrender.com'])},
  {PROFITIA_CLERK_AUTHORIZED_PARTIES:JSON.stringify([origin,'https://other.test'])},
  {PILOT2_E1_DATABASE_URL:env.PILOT2_PUBLIC_CATALOG_URL},
 ])assert.throws(()=>readPilot2HumanConfiguration({...env,...patch}))
})
