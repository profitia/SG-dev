import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
test('public AppShell source has no design runtime, fixtures, private module implementation or inspector',()=>{
 const files=fs.readdirSync(path.join(root,'components/appshell')).filter(f=>/\.(tsx|css)$/.test(f))
 assert(files.length>=4)
 for(const file of files){
  let s=fs.readFileSync(path.join(root,'components/appshell',file),'utf8')
  if(file==='xray-module-host.tsx')for(const accepted of ["import type {AssistantApplicationContext} from '@profitia/srm-xray/full-report';","import {FullXRayWorkflow} from '@profitia/srm-xray/full-workflow';","import {createSupplierSearchGateway} from '@profitia/srm-xray/supplier-search-gateway';","import '@profitia/srm-xray/full-report.css';"])s=s.replace(accepted,'')
  assert.doesNotMatch(s,/DeliveryRuntime|DeliveryVisibility|delivery-registry|appshell-provenance|library-registry|DashboardRelations|CanonHistoryDialog|data-delivery|data-magicpath|preparedReply|launchTimer|simulation-suffix|tylko projekt|symulacja|Tomaszu|Tomasz/,'Excluded source: '+file)
  assert.doesNotMatch(s.replaceAll('http://www.w3.org/2000/svg','').replace("import {BenchmarkFinderClient} from '../benchmark-finder/benchmark-finder-client'",'').replace("import {SupplierXRayWorkflow} from '@profitia/srm-xray/workflow';",''),/from ['"].*(?:benchmark-finder|srm-xray|assessment|cic|\/api\/|ui-relations)|https?:\/\//,'No business module or remote design dependency: '+file)
 }
})
test('theme and style scope cannot change global document preferences',()=>{
 const ui=fs.readFileSync(path.join(root,'components/appshell/platform-appshell.tsx'),'utf8')
 const css=fs.readFileSync(path.join(root,'components/appshell/platform-appshell.css'),'utf8')
 assert.doesNotMatch(ui,/document\.documentElement|document\.body|history\.|window\.location|srm:interface-theme/)
 assert.doesNotMatch(css,/(^|})\s*(?:html|body|:root)\s*[\[{:]/)
 assert(css.includes('prefers-reduced-motion'));assert(css.includes('1100px'));assert(css.includes('760px'));assert(css.includes('420px'))
 assert(ui.includes('data-theme={theme}'));assert(ui.includes('aria-pressed={theme === value}'))
})
test('root and account completion share the same workspace entry while registration remains the existing flow',()=>{
 const home=fs.readFileSync(path.join(root,'app/[locale]/page.tsx'),'utf8')
 const completion=fs.readFileSync(path.join(root,'app/[locale]/account/page.tsx'),'utf8')
 const entry=fs.readFileSync(path.join(root,'components/appshell/platform-appshell-entry.tsx'),'utf8')
 for(const s of [home,completion])assert(s.includes('<PlatformAppShellEntry'))
 assert(entry.includes('presentation="workspace"'));assert(entry.includes('<SelfServiceAuthentication'));assert(entry.includes('/register'))
 assert.doesNotMatch(entry,/benchmark-finder|supplier-intelligence|iframe|\/api\//)
})
test('canonical dashboard and ADP are explicit children of one persistent account guard',()=>{
 const layout=fs.readFileSync(path.join(root,'app/[locale]/dashboard/layout.tsx'),'utf8')
 const guard=fs.readFileSync(path.join(root,'components/auth/account-landing.tsx'),'utf8')
 const middleware=fs.readFileSync(path.join(root,'middleware.ts'),'utf8')
 assert(layout.includes('<PlatformAppShellEntry'));assert(layout.includes(' dashboard'))
 for(const page of ['app/[locale]/dashboard/page.tsx','app/[locale]/dashboard/adp/page.tsx','app/[locale]/dashboard/xray/page.tsx'])assert(fs.readFileSync(path.join(root,page),'utf8').includes('return null'))
 assert(guard.includes('workspaceReady && !dashboard'));assert(guard.includes('router.replace(dashboardPath(locale))'))
 assert(middleware.includes('dashboard(?:\\/(?:adp|benchmark-finder|xray))?'));assert(!middleware.includes('dashboard.*'))
 assert.doesNotMatch(guard,/\bgrant\s*\(|organisationId|organizationId|signUp\(|createUser|\/api\/adp/)
})
