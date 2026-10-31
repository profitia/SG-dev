import {createCurrentFreshReportHost,type CurrentFreshReportRefreshOptions,type CurrentFreshReportReadOptions,type CurrentFreshReportReadOnlyProbeOptions} from '../../src/current-fresh-report.mjs'
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {PublicIdentityApplication} from '@profitia/platform-contracts/public-request'
declare const clerk:ClerkIdentityClient,identity:PublicIdentityApplication
declare const probe:CurrentFreshReportReadOptions<{query(sql:string):Promise<void>}>
declare const refresh:CurrentFreshReportRefreshOptions<{query(sql:string):Promise<void>}>
declare const request:Request
const receiverBoundary={publicOrigins:['https://srm.fixture.test'],internalOrigins:['http://127.0.0.1:9999']}
const host=createCurrentFreshReportHost({clerk,identity,receiverBoundary,probe,refresh,read:probe})
const input={request,organisationId:'11111111-1111-4111-8111-111111111111',nip:'5272443955',idempotencyKey:null}
const actions={probe:async()=>({status:'MISS'}),refresh:async()=>({}),work:async()=>{},read:async()=>({status:'READY',value:{ok:true}})}
const result:Promise<{ok:boolean}>=host.execute<{ok:boolean}>(input,actions)
void result
// @ts-expect-error Client identity injection is not a producer option.
createCurrentFreshReportHost({clerk,identity,receiverBoundary,probe,refresh,read:probe,authenticate:async()=>null})
// @ts-expect-error A Work callback cannot provide the disclosed response.
host.execute(input,{...actions,work:async()=>({status:'READY',value:'bypass'})})
// @ts-expect-error A raw actor is not an opening input.
host.execute({...input,actor:{kind:'HUMAN'}},actions)
declare const readOnlyProbe:CurrentFreshReportReadOnlyProbeOptions<{query(sql:string):Promise<void>}>
const guarded=createCurrentFreshReportHost({clerk,identity,receiverBoundary,probe:readOnlyProbe,refresh,read:probe,probeReadOnly:{statements:['SELECT 1']}})
const closedResult:Promise<{ok:boolean}>=guarded.execute(input,{...actions,probe:async(_context,port)=>{
 await port.query('SELECT 1',[])
 // @ts-expect-error No raw transaction or connection is exposed to a probe.
 port.release()
 return {status:'MISS'}
},ready:async(value,_context,transaction)=>{await transaction.query('SELECT 1');return {ok:!!value}}})
void closedResult
// @ts-expect-error Read-only adoption requires explicit READY handling.
guarded.execute(input,actions)
// @ts-expect-error Default mode has no implicit READY effect writer.
host.execute(input,{...actions,ready:async()=>({ok:true})})
