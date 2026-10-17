import assert from 'node:assert/strict'
import test from 'node:test'
import { selectLegacySessionStorage, type BrowserSessionStorage } from '../lib/platform/browser-session-storage'

function fixture() {
  const rows=new Map([['benchmark-finder-recent-searches','old-demo-history'],['benchmark-finder-locale-switch-state','old-demo-snapshot']])
  const calls:string[]=[]
  const storage:BrowserSessionStorage={getItem:key=>{calls.push('read');return rows.get(key)??null},setItem:(key,value)=>{calls.push('write');rows.set(key,value)},removeItem:key=>{calls.push('remove');rows.delete(key)}}
  return {rows,calls,storage}
}
test('the explicit legacy adapter retains the same two keys and existing read/write behavior',()=>{
  const f=fixture(),storage=selectLegacySessionStorage('legacy',()=>f.storage)
  assert(storage);assert.equal(storage.getItem('benchmark-finder-recent-searches'),'old-demo-history')
  storage.setItem('benchmark-finder-recent-searches','updated-demo-history')
  assert.equal(f.rows.get('benchmark-finder-recent-searches'),'updated-demo-history')
  assert.equal(f.rows.get('benchmark-finder-locale-switch-state'),'old-demo-snapshot')
})
for(const policy of ['volatile','clerk',undefined,null,{},true,'LEGACY']){
  test(`unknown or individual policy ${JSON.stringify(policy)} cannot resolve, read, overwrite or remove legacy history`,()=>{
    const f=fixture(),before=[...f.rows];let resolutions=0
    assert.equal(selectLegacySessionStorage(policy,()=>{resolutions++;return f.storage}),null)
    assert.equal(resolutions,0);assert.deepEqual(f.calls,[]);assert.deepEqual([...f.rows],before)
  })
}
test('unavailable browser storage stays unavailable without a secondary persistence fallback',()=>{
  assert.equal(selectLegacySessionStorage('legacy',()=>{throw Error('storage blocked')}),null)
  assert.equal(selectLegacySessionStorage('legacy',()=>null),null)
})
