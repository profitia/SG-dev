const latestAcceptance=()=>JSON.parse(fs.readFileSync(new URL('../platform-integration.json',import.meta.url)));
const humanReadAcceptance=()=>{const a=latestAcceptance();return a.settledExternalFailureCompatibilityOnly?a.previousAcceptance:a}
const peerAcceptance=()=>{const a=humanReadAcceptance();return a.currentHumanReadCompatibilityOnly?a.previousAcceptance:a}
const currentAcceptance=()=>{const a=peerAcceptance();return a.peerOperationCompatibilityOnly?a.previousAcceptance:a}
const diagnosticsAcceptance=()=>{const a=currentAcceptance();return a.sdk130CompatibilityOnly?a.previousAcceptance:a}
const beforeDiagnostics=()=>diagnosticsAcceptance().previousAcceptance
import test from 'node:test'
import assert from 'node:assert/strict'
import {MessageChannel} from 'node:worker_threads'
import {webcrypto,createHash} from 'node:crypto'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {setTimeout as delay} from 'node:timers/promises'
import {mountMaps} from '@profitia/maps-embed'
import {mapsMessage} from '@profitia/maps-contracts'
import {openEmbeddedReadClient} from '@profitia/platform-contracts/embedded-read-channel'

test('independent host tolerates runtime boot beyond the E1 read deadline and rejects wrong origin, window and version', async () => {
  const listeners = new Set(), statuses = [], selections = []
  let client, reads = 0, removed = false
  const frame = {setAttribute() {}, remove() {removed = true}, contentWindow: {postMessage(message, origin, ports) {
    assert.equal(origin, 'https://maps.example')
    client = openEmbeddedReadClient({port: ports[0], instanceId: message.instanceId})
  }}}
  const win = {location: {origin: 'https://host.example'}, crypto: webcrypto, MessageChannel, setTimeout, clearTimeout,
    addEventListener: (_name, f) => listeners.add(f), removeEventListener: (_name, f) => listeners.delete(f)}
  const container = {ownerDocument: {defaultView: win, createElement: () => frame}, append() {}}
  const mount = mountMaps({container, runtimeOrigin: 'https://maps.example', readLocations: async () => {reads++; return [{id: 'a', label: 'Host point', position: {lat: 1, lng: 2}}]}, onStatus: x => statuses.push(x), onSelect: x => selections.push(x), timeoutMs: 500, startupTimeoutMs: 2000})
  const instanceId = new URL(frame.src).searchParams.get('instanceId')
  const receive = [...listeners][0]
  for (const event of [
    {origin: 'https://evil.example', source: frame.contentWindow, data: mapsMessage('ready', instanceId)},
    {origin: 'https://maps.example', source: {}, data: mapsMessage('ready', instanceId)},
    {origin: 'https://maps.example', source: frame.contentWindow, data: {...mapsMessage('ready', instanceId), version: '99'}},
  ]) receive(event)
  assert.equal(client, undefined)
  await delay(550)
  assert.equal(removed, false)
  assert.deepEqual(statuses, [])
  const event = data => ({origin: 'https://maps.example', source: frame.contentWindow, data})
  receive(event(mapsMessage('ready', instanceId)))
  const response = await client.read({view: 'locations'})
  assert.equal(response.status, 200); assert.equal(reads, 1)
  assert.equal((await client.read({view: 'locations', organisationId: 'other'})).status, 400)
  assert.equal(reads, 1)
  receive(event(mapsMessage('select', instanceId, {locationId: 'not-delivered'})))
  receive(event(mapsMessage('select', instanceId, {locationId: 'a'})))
  assert.deepEqual(selections, ['a'])
  receive(event(mapsMessage('rendered', instanceId)))
  assert.deepEqual(statuses, ['ready'])
  mount.close(); client.close(); await delay(10)
  assert.equal(removed, true); assert.equal(listeners.size, 0)
})

test('current host access denial prevents a private projection from reaching the runtime', async () => {
  const channel = new MessageChannel()
  const {openEmbeddedReadHost} = await import('@profitia/platform-contracts/embedded-read-channel')
  const host = openEmbeddedReadHost({port: channel.port1, instanceId: 'denied-instance-001', parseSelection: value => value.view === 'locations' ? value : null,
    read: async () => ({status: 403, body: {error: 'Access denied'}})})
  const client = openEmbeddedReadClient({port: channel.port2, instanceId: 'denied-instance-001'})
  assert.equal((await client.read({view: 'locations'})).status, 403)
  host.close(); client.close()
})

test('explicit platform1.24 receipt accepts only tested peers and the unchanged current public channel', async () => {
  const newest=beforeDiagnostics().previousAcceptance,publication=newest.previousAcceptance,latest=publication.previousAcceptance.previousAcceptance,current=latest.previousAcceptance,accepted=current.previousAcceptance
  const entry=import.meta.resolve('@profitia/platform-contracts/embedded-read-channel'),root=new URL('../',entry)
  const installed=JSON.parse(fs.readFileSync(new URL('package.json',root)))
  assert.equal(accepted.taskId,'SRM-E1-SUPPLIER-LOCATION-MAPS-C16-ADOPTION-20261021')
  assert.equal(accepted.producer.sourceSha,'88c3337d943fa3893f2f357bb11b78c565e50047');assert.equal(accepted.producer.taskId,'ARCHITECTURE-SUPPLIER-LOCATIONS-E1-CI-20261021')
  assert.equal(installed.version,latestAcceptance().platformVersion);assert.equal(newest.platformVersion,'1.29.0');assert.equal(publication.platformVersion,'1.28.0');assert.equal(latest.platformVersion,'1.26.0');assert.deepEqual(publication.allowedPeerVersions,[...latest.allowedPeerVersions,'1.27.0','1.28.0']);assert.equal(publication.unmeteredSourceOptedIn,false);assert.equal(publication.sql024Installed,false);assert.equal(latest.accountRevalidationOptedIn,false);assert.deepEqual(latest.sourceDigests,current.sourceDigests);assert.deepEqual(latest.allowedPeerVersions,[...current.allowedPeerVersions,'1.26.0']);assert.equal(accepted.platformVersion,'1.24.0')
  assert.deepEqual(accepted.allowedPeerVersions,['1.18.0','1.19.0','1.20.0','1.21.0','1.22.0','1.23.0','1.24.0'])
  const peer=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.resolve('@profitia/maps-embed'))))
  assert.equal(peer.peerDependencies['@profitia/platform-contracts'],latestAcceptance().allowedPeerVersions.join(' || '))
  assert.deepEqual(current.allowedPeerVersions,[...accepted.allowedPeerVersions,'1.25.0']);assert.deepEqual(current.sourceDigests,accepted.sourceDigests)
  assert.equal(current.producer.sourceSha,'f35c82b6d9d39720c04b4df2c6f0042f5379982a');assert.equal(current.locationAdmissionOptedIn,false)
  const sdk=await import('@profitia/platform-contracts/embedded-read-channel')
  assert.equal(accepted.previousAcceptance.platformVersion,'1.23.0')
  assert.equal(accepted.previousAcceptance.previousAcceptance.previousAcceptance.producer.pullRequest,551)
  assert.equal(accepted.previousAcceptance.previousAcceptance.platformVersion,'1.22.0')
  assert.deepEqual(accepted.sourceDigests,accepted.previousAcceptance.sourceDigests)
  assert.equal(accepted.publicWebTransportAdopted,false);assert.equal(accepted.privateSupplierAccessAdopted,false);assert.equal(accepted.privateAcquisitionAdopted,false)
  assert.equal(accepted.nativeSqlWorkAdopted,false)
  assert.equal(accepted.readWireContract,sdk.EMBEDDED_READ_CONTRACT.id+'@'+sdk.EMBEDDED_READ_CONTRACT.version)
  assert.deepEqual(Object.keys(accepted.sourceDigests).sort(),['src/embedded-channel-core.mjs','src/embedded-read-channel.d.mts','src/embedded-read-channel.mjs'])
  for(const[path,digest]of Object.entries(accepted.sourceDigests))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
  for(const key of['supplierLocationPrivateOperationsAdopted','paidGeocodingEnabled','privateInspectionAdopted','organizationLocationPersistenceAdopted','srmFeatureMounted','providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(accepted[key],false,key)
})


test('SDK1.27 recognition retains the entire Maps receipt and enables no provider or unmetered Source',()=>{
 const a=beforeDiagnostics().previousAcceptance.previousAcceptance.previousAcceptance
 const bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/maps-runtime/platform-integration.json'])
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256)
 assert.deepEqual(a.previousAcceptance,JSON.parse(bytes));assert.deepEqual(a.sourceDigests,a.previousAcceptance.sourceDigests)
 for(const flag of ['unmeteredSourceOptedIn','sql024Installed','srmFeatureMounted','providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag)
})


test('SDK1.28 recognition preserves the entire Maps receipt and activates no report admission',()=>{
 const a=beforeDiagnostics().previousAcceptance.previousAcceptance,bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/maps-runtime/platform-integration.json']);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);assert.deepEqual(a.previousAcceptance,JSON.parse(bytes));assert.deepEqual(a.sourceDigests,a.previousAcceptance.sourceDigests);
 for(const flag of ['reportAdmissionOptedIn','sql025Installed','srmFeatureMounted','providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag);
});


test('SDK1.29 acceptance retains complete Maps history and the identical read channel without request quota adoption',()=>{
 const a=beforeDiagnostics().previousAcceptance,bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/maps-runtime/platform-integration.json']);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);assert.deepEqual(a.previousAcceptance,JSON.parse(bytes));
 assert.equal(a.platformVersion,'1.29.0');assert.deepEqual(a.allowedPeerVersions,[...a.previousAcceptance.allowedPeerVersions,'1.29.0']);
 assert.equal(a.producer.pullRequest,712);assert.equal(a.producer.sourceSha,'47396fe1cb8aca06d11e2e712e65d53651c296c1');
 assert.deepEqual(a.sourceDigests,a.previousAcceptance.sourceDigests);assert.equal(a.readWireContract,a.previousAcceptance.readWireContract);
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/embedded-read-channel'));
 for(const [path,digest]of Object.entries(a.sourceDigests)){
  const accepted=execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+path]);
  assert.equal(createHash('sha256').update(accepted).digest('hex'),digest,path);
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path);
 }
 for(const flag of ['requestQuotaOptedIn','sql027Installed','reportAdmissionOptedIn','unmeteredSourceOptedIn','srmFeatureMounted','providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag);
});


test('SDK1.29.1 compatibility preserves every previous Maps receipt and the exact public read channel',()=>{
 const a=beforeDiagnostics();
 const bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/maps-runtime/platform-integration.json']);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);assert.deepEqual(a.previousAcceptance,JSON.parse(bytes));
 assert.equal(a.platformVersion,'1.29.1');assert.deepEqual(a.allowedPeerVersions,[...a.previousAcceptance.allowedPeerVersions,'1.29.1']);
 assert.deepEqual(a.sourceDigests,a.previousAcceptance.sourceDigests);assert.equal(a.readWireContract,a.previousAcceptance.readWireContract);
 for(const flag of ['requestQuotaOptedIn','sql027Installed','reportAdmissionOptedIn','unmeteredSourceOptedIn','srmFeatureMounted','providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag);
});


test('SDK1.29.2 diagnostics source recognition preserves Maps semantics and complete accepted history',()=>{
 const a=diagnosticsAcceptance(),bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/maps-runtime/platform-integration.json']);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);assert.deepEqual(a.previousAcceptance,JSON.parse(bytes));
 assert.equal(a.platformVersion,'1.29.2');assert.deepEqual(a.allowedPeerVersions,[...a.previousAcceptance.allowedPeerVersions,'1.29.2']);
 assert.deepEqual(a.sourceDigests,a.previousAcceptance.sourceDigests);assert.equal(a.readWireContract,a.previousAcceptance.readWireContract);
 assert.equal(a.producer.pullRequest,738);assert.equal(a.diagnosticObservationActivated,false);
 for(const flag of ['requestQuotaOptedIn','sql027Installed','reportAdmissionOptedIn','unmeteredSourceOptedIn','srmFeatureMounted','providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag);
});


test('SDK1.30 compatibility keeps every Maps receipt and no current-human-read opt-in or deployment',()=>{
 const a=currentAcceptance(),bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/maps-runtime/platform-integration.json']);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);assert.deepEqual(a.previousAcceptance,JSON.parse(bytes));
 assert.equal(a.platformVersion,'1.30.0');assert.deepEqual(a.allowedPeerVersions,[...a.previousAcceptance.allowedPeerVersions,'1.30.0']);
 assert.deepEqual(a.sourceDigests,a.previousAcceptance.sourceDigests);assert.equal(a.readWireContract,a.previousAcceptance.readWireContract);
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/embedded-read-channel'));
 for(const [file,digest]of Object.entries(a.sourceDigests))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),digest,file);
 for(const flag of ['currentHumanReadOptedIn','srmFeatureMounted','providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag);
});


test('SDK1.31 peer source compatibility preserves every prior Maps receipt and the unchanged read channel without activation',()=>{
 const a=peerAcceptance(),bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/maps-runtime/platform-integration.json']);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);assert.deepEqual(a.previousAcceptance,JSON.parse(bytes));
 assert.equal(a.platformVersion,'1.31.0');assert.deepEqual(a.allowedPeerVersions,[...a.previousAcceptance.allowedPeerVersions,'1.31.0']);assert.deepEqual(a.sourceDigests,a.previousAcceptance.sourceDigests);assert.equal(a.readWireContract,a.previousAcceptance.readWireContract);
 assert.equal(a.logicalOwner,'Maps Capability');assert.equal(a.producer.pullRequest,773);assert.equal(a.peerOperationAdopted,false);assert.equal(a.xrayFunctionalityMounted,false);
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/embedded-read-channel'));
 for(const[file,digest]of Object.entries(a.sourceDigests))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),digest,file);
 for(const flag of ['srmFeatureMounted','providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed','paidGeocodingEnabled'])assert.equal(a[flag],false,flag);
});

test('SDK1.32 compatibility keeps Maps channel and every prior receipt unchanged without activation',()=>{
 const a=humanReadAcceptance(),bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/maps-runtime/platform-integration.json'])
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256)
 assert.deepEqual(a.previousAcceptance,JSON.parse(bytes));assert.deepEqual(a.sourceDigests,a.previousAcceptance.sourceDigests)
 assert.deepEqual(a.allowedPeerVersions,[...a.previousAcceptance.allowedPeerVersions,'1.32.0'])
 assert.equal(a.currentHumanReadCompatibilityOnly,true);assert.equal(a.currentHumanReadOptedIn,false)
 for(const flag of ['providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed','paidGeocodingEnabled'])assert.equal(a[flag],false,flag)
})


test('SDK1.32.1 compatibility preserves Maps history without adopting external failure handling',()=>{
 const a=latestAcceptance(),bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/maps-runtime/platform-integration.json'])
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);assert.deepEqual(a.previousAcceptance,JSON.parse(bytes))
 assert.equal(a.platformVersion,'1.32.1');assert.deepEqual(a.allowedPeerVersions,[...a.previousAcceptance.allowedPeerVersions,'1.32.1'])
 assert.deepEqual(a.sourceDigests,a.previousAcceptance.sourceDigests);assert.equal(a.readWireContract,a.previousAcceptance.readWireContract)
 assert.equal(a.settledExternalFailureCompatibilityOnly,true);assert.equal(a.settledExternalFailureAdopted,false)
 for(const flag of ['providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed','paidGeocodingEnabled'])assert.equal(a[flag],false,flag)
})
