// SYNTHETIC_ONLY: real SQL/current E1/SourceHub protocol, offline vendor transport.
import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync, randomUUID, createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {consumerFixture} from '../../platform-source-hub/test/first-party-fixtures.mjs'
import {fixture} from './fixtures.mjs'
import {createCalendarSourceService} from '../src/source-service.mjs'

test('ECR SERVICE admits thirteen distinct Calendar intents, preserves audit and refuses foreign org/component and revoked grant before upstream', async () => {
  const hub = await consumerFixture(); let ecr
  try {
    ecr = await fixture({seed: false, baseE1: hub.e1})
    const role = 'economic_calendar_development_ingest', grantId = randomUUID(), serviceId = randomUUID(),
      componentId = 'SYNTHETIC_ONLY_ECR_UNMETERED', key = generateKeyPairSync('ed25519'), org = '11111111-1111-4111-8111-111111111111'
    await hub.e1.asOwner(0, async q => {
      await q.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')", [role, ecr.configuration.applicationId])
      await q.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'SPENDGURU_SAAS','SYNTHETIC_ONLY','synthetic-ecr-service-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [role, randomUUID(), serviceId])
      await q.query("INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'knowledge.read','market','api.trading-economics.economic-calendar','ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [grantId, role, org])
      await q.query("INSERT INTO profitia_e1_authority.source_components(component_id,key_id,application_id,login_role,receiver_application_id,source_origin,public_key,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,'SYNTHETIC_ONLY',$2,$3,$4,'urn:profitia:service:synthetic-ecr:development',$5,'SYNTHETIC_ONLY','synthetic-ecr-service-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [componentId, ecr.configuration.applicationId, role, hub.e1.apps[1], key.publicKey.export({type: 'spki', format: 'pem'})])
    })
    const configuration = {environment: 'development', componentId, consumerApplicationId: ecr.configuration.applicationId,
      receiverApplicationId: hub.e1.apps[1], sourceOrigin: 'urn:profitia:service:synthetic-ecr:development',
      targetOrigin: hub.e1.targetOrigin, keyId: 'SYNTHETIC_ONLY', privateKey: key.privateKey}
    const service = createCalendarSourceService(configuration, {fetchImpl: request => hub.app.handle(request)})
    const args = {criteria: {countries: ['Poland'], indicators: ['Inflation Rate']}, organisation: org, grantId}
    const receipts = new Set()
    for (let n = 1; n <= 13; n++) {
      const result = await service.acquire({...args, idempotencyKey: 'SYNTHETIC_ONLY_ECR_SERVICE_' + n})
      assert.equal(result.items.length, 1); assert.equal(result.usage.upstreamAttempts, 1)
      receipts.add(result.usage.receiptRef)
    }
    assert.equal(receipts.size, 13); assert.equal(hub.source.state.providerCalls.length, 13)
    const before = hub.source.state.providerCalls.length
    await assert.rejects(service.acquire({...args, organisation: '22222222-2222-4222-8222-222222222222', idempotencyKey: 'SYNTHETIC_ONLY_ECR_FOREIGN_ORG'}))
    // A different registered component/key cannot claim the ECR application.
    const report = hub.e1.components.report
    const foreign = createCalendarSourceService({...configuration, componentId: report.id, sourceOrigin: report.origin,
      keyId: 'synthetic-key', privateKey: report.key.privateKey}, {fetchImpl: request => hub.app.handle(request)})
    await assert.rejects(foreign.acquire({...args, idempotencyKey: 'SYNTHETIC_ONLY_ECR_FOREIGN_COMPONENT'}))
    await hub.e1.asOwner(0, q => q.query("UPDATE profitia_services.read_grants SET status='REVOKED' WHERE grant_id=$1", [grantId]))
    await assert.rejects(service.acquire({...args, idempotencyKey: 'SYNTHETIC_ONLY_ECR_REVOKED'}))
    assert.equal(hub.source.state.providerCalls.length, before)
    const ledger = await hub.e1.asOwner(1, q => q.query('SELECT component_id,actor_id,consumer_application_id FROM source_hub.first_party_acquisitions'), 'source_hub_development_owner')
    assert.equal(ledger.rowCount, 13)
    assert(ledger.rows.every(r => r.component_id === componentId && r.actor_id === serviceId && r.consumer_application_id === ecr.configuration.applicationId))
  } finally {if (ecr) await ecr.close(); await hub.close()}
})

test('owner enrollment SQL applies exactly one Calendar grant in a disposable synthetic transaction and refuses numeric quota drift/replay', async () => {
  const hub = await consumerFixture(), root = hub.e1.databases[0]
  try {
    const p = JSON.parse(readFileSync(new URL('../operations/source-service-profile.json', import.meta.url), 'utf8'))
    const sql = readFileSync(new URL('../operations/enroll-source-service.sql', import.meta.url), 'utf8')
    const role = await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [p.role])
    if (!role.rowCount) await root.query('CREATE ROLE economic_calendar_development_ingest LOGIN PASSWORD NULL NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION')
    await root.query('BEGIN')
    try {
      // Only this disposable fixture imitates the deployment metadata and
      // proposed organisation ID. No real directory data or network is used.
      await root.query('SET LOCAL ROLE profitia_access_owner')
      await assert.rejects(root.query(sql), /EXACT_CENTRAL_FIRST_PARTY_INSTALLATION_REQUIRED/)
      await root.query('ROLLBACK'); await root.query('BEGIN'); await root.query('SET LOCAL ROLE profitia_access_owner')
      await root.query("UPDATE profitia_access.installation SET project_id='spring-bread-28217539',branch_id='br-sparkling-term-b99l107x'")
      await root.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')", [p.organisationId])
      await root.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SPENDGURU',ARRAY['market'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$2)", [p.organisationId, p.expiresAt])
      await root.query('UPDATE profitia_e1_authority.source_receivers SET expires_at=$1,target_origin=$2', [p.expiresAt, p.targetOrigin])
      p.status = 'ENROLLED'; p.deploymentId = '1'.repeat(40)
      p.ownerDecisionRef = 'owner-decision:sha256:' + createHash('sha256').update('SYNTHETIC_ONLY_OWNER_GO').digest('hex')
      p.publicKey = generateKeyPairSync('ed25519').publicKey.export({type: 'spki', format: 'pem'})
      p.publicKeySha256 = createHash('sha256').update(p.publicKey).digest('hex')
      await root.query('SAVEPOINT drift')
      await root.query("SELECT set_config('ecr.source_service_spec',$1,true)", [JSON.stringify({...p, maximumHubRequests: 100})])
      await assert.rejects(root.query(sql), /EXACT_APPROVED_ECR_CALENDAR_PROFILE_REQUIRED/)
      await root.query('ROLLBACK TO SAVEPOINT drift')
      await root.query("SELECT set_config('ecr.source_service_spec',$1,true)", [JSON.stringify(p)])
      await root.query(sql)
      const grants = await root.query('SELECT resource_id,organisation_id FROM profitia_services.read_grants WHERE login_role=$1', [p.role])
      assert.equal(grants.rowCount, 1); assert.equal(grants.rows[0].resource_id, 'api.trading-economics.economic-calendar')
      assert.equal(grants.rows[0].organisation_id, p.organisationId)
      assert.equal((await root.query('SELECT 1 FROM profitia_e1_authority.source_components WHERE component_id=$1 AND public_key=$2', [p.componentId, p.publicKey])).rowCount, 1)
      await assert.rejects(root.query(sql), /IDENTITY_ALREADY_EXISTS_STOP_AND_RECONCILE/)
    } finally {await root.query('ROLLBACK')}
  } finally {await hub.close()}
})
