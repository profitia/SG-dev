import test from 'node:test'
import assert from 'node:assert/strict'
import {MessageChannel} from 'node:worker_threads'
import {webcrypto,createHash} from 'node:crypto'
import fs from 'node:fs'
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

test('explicit platform1.22 receipt accepts only tested peers and the unchanged current public channel', async () => {
  const accepted=JSON.parse(fs.readFileSync(new URL('../platform-integration.json',import.meta.url)))
  const entry=import.meta.resolve('@profitia/platform-contracts/embedded-read-channel'),root=new URL('../',entry)
  const installed=JSON.parse(fs.readFileSync(new URL('package.json',root)))
  assert.equal(accepted.taskId,'SRM-E1-MAPS-PLATFORM-122-COMPATIBILITY-20261020')
  assert.equal(accepted.producer.sourceSha,'e71f9953d74f683e447f315e633db3696ec365ba');assert.equal(accepted.producer.taskId,'ARCHITECTURE-E1-PRIVATE-ACQUISITION-CONTRACT-20261019')
  assert.equal(installed.version,'1.22.0');assert.equal(accepted.platformVersion,installed.version)
  assert.deepEqual(accepted.allowedPeerVersions,['1.18.0','1.19.0','1.20.0','1.21.0','1.22.0'])
  const peer=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.resolve('@profitia/maps-embed'))))
  assert.equal(peer.peerDependencies['@profitia/platform-contracts'],'1.18.0 || 1.19.0 || 1.20.0 || 1.21.0 || 1.22.0')
  const sdk=await import('@profitia/platform-contracts/embedded-read-channel')
  assert.equal(accepted.previousAcceptance.platformVersion,'1.21.0')
  assert.equal(accepted.previousAcceptance.producer.pullRequest,551)
  assert.equal(accepted.previousAcceptance.previousAcceptance.platformVersion,'1.20.0')
  assert.deepEqual(accepted.sourceDigests,accepted.previousAcceptance.sourceDigests)
  assert.equal(accepted.privateSupplierAccessAdopted,false);assert.equal(accepted.privateAcquisitionAdopted,false)
  assert.equal(accepted.nativeSqlWorkAdopted,false)
  assert.equal(accepted.readWireContract,sdk.EMBEDDED_READ_CONTRACT.id+'@'+sdk.EMBEDDED_READ_CONTRACT.version)
  assert.deepEqual(Object.keys(accepted.sourceDigests).sort(),['src/embedded-channel-core.mjs','src/embedded-read-channel.d.mts','src/embedded-read-channel.mjs'])
  for(const[path,digest]of Object.entries(accepted.sourceDigests))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
  for(const key of['privateInspectionAdopted','organizationLocationPersistenceAdopted','srmFeatureMounted','providerConfigurationChanged','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(accepted[key],false,key)
})
