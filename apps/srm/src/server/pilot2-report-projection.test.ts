import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {isOperationDenied,type OperationContext} from '@profitia/platform-contracts/operation-context'
import {REPORT_DATA_SQL,REPORT_PRIVATE_DATA_SQL} from './report-data'
import {pilot2PrivateReportProjection,getPilot2ScannerRuntime} from './pilot2-report-projection'

test('explicit private source preserves the accepted full SQL and never selects public financial tables',()=>{
 const old=execFileSync('git',['show','b41ebbdc7bfc10ad1fa91543b0ee38506f97b454:apps/srm/src/server/report-data.ts'],{encoding:'utf8'})
 const shared=/export const REPORT_SHARED_FINANCIAL_SELECT = `([\s\S]*?)`;/u.exec(old)![1]
 const full=/export const REPORT_DATA_SQL = `([\s\S]*?)`;/u.exec(old)![1].replace('${REPORT_SHARED_FINANCIAL_SELECT}',shared)
 assert.equal(REPORT_DATA_SQL,full)
 assert(!/srm\.catalog_(companies|financial_facts|financial_indicators)\b/.test(REPORT_PRIVATE_DATA_SQL))
 assert(REPORT_PRIVATE_DATA_SQL.includes('d.organization_id=$2::uuid'))
 assert(REPORT_PRIVATE_DATA_SQL.includes('l.organization_id = $2::uuid'))
 assert(!REPORT_PRIVATE_DATA_SQL.includes('$4'))
})
test('the private business projection refuses foreign owner, service actors and other company selection before SQL',async()=>{
 assert.throws(()=>pilot2PrivateReportProjection('short'),isOperationDenied)
 assert.throws(()=>getPilot2ScannerRuntime({SRM_PILOT2_PRIVATE_SCANNER:'false'}),isOperationDenied)
 const port=pilot2PrivateReportProjection('synthetic_'.repeat(6)),org='11111111-1111-4111-8111-111111111111',nip='7820021192'
 const context={operation:'supplier.report.project',actorKind:'HUMAN',actorId:'22222222-2222-4222-8222-222222222222',
  organisationId:org,resource:{dataClass:'ORGANISATION_PRIVATE',ownerOrganisationId:org,id:'supplier-report:COMPANY:'+nip}}
 let queries=0;const client={query:async()=>{queries++;throw Error('Unexpected SQL')}} as never
 for(const changed of[
  {...context,actorKind:'SERVICE'}, {...context,organisationId:'33333333-3333-4333-8333-333333333333'},
  {...context,subjectUserId:'44444444-4444-4444-8444-444444444444'},
  {...context,resource:{...context.resource,id:'supplier-report:COMPANY:7772776017'}},
  {...context,resource:{...context.resource,dataClass:'SHARED_KNOWLEDGE'}},
 ])await assert.rejects(port.project(changed as OperationContext,client,client,{nip,entityType:'COMPANY'},'a'.repeat(64)),isOperationDenied)
 assert.equal(queries,0)
})
