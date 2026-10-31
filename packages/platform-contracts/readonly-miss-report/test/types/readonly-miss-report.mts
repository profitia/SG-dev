import {createReadonlyMissReportHost,type ReadonlyMissReportRefreshOptions,type ReadonlyMissReportReadOptions,type ReadonlyMissReportReadOnlyProbeOptions} from '../../src/readonly-miss-report.mjs'
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {PublicIdentityApplication} from '@profitia/platform-contracts/public-request'
declare const clerk:ClerkIdentityClient,identity:PublicIdentityApplication
interface Transaction {query(sql:string):Promise<void>}
declare const probe:ReadonlyMissReportReadOnlyProbeOptions<Transaction>
declare const refresh:ReadonlyMissReportRefreshOptions<Transaction>,read:ReadonlyMissReportReadOptions<Transaction>
declare const request:Request
const receiverBoundary={publicOrigins:['https://srm.fixture.test'],internalOrigins:['http://127.0.0.1:9999']}
const options={clerk,identity,receiverBoundary,probe,refresh,read,probeReadOnly:{statements:['SELECT 1']}}
const host=createReadonlyMissReportHost(options)
const input={request,organisationId:'11111111-1111-4111-8111-111111111111',nip:'5272443955',idempotencyKey:null}
const actions={probe:async()=>({status:'MISS'}),refresh:async()=>({}),work:async()=>{},read:async()=>({status:'READY',value:{ok:true}})}
const result:Promise<{ok:boolean}>=host.execute(input,{...actions,probe:async(_context,port)=>{
 await port.query('SELECT 1',[])
 // @ts-expect-error No raw transaction or connection is exposed to a probe.
 port.release()
 return {status:'MISS'}
},ready:async(value,_context,transaction)=>{await transaction.query('SELECT 1');return {ok:!!value}}})
void result
// @ts-expect-error A separate READY effect writer is mandatory.
host.execute(input,actions)
// @ts-expect-error The read-only policy is mandatory; no legacy fallback.
createReadonlyMissReportHost({clerk,identity,receiverBoundary,probe,refresh,read})
// @ts-expect-error Client identity injection is not a producer option.
createReadonlyMissReportHost({...options,authenticate:async()=>null})
// @ts-expect-error A Work callback cannot provide the disclosed response.
host.execute(input,{...actions,ready:async()=>({ok:true}),work:async()=>({status:'READY',value:'bypass'})})
// @ts-expect-error A raw actor is not an opening input.
host.execute({...input,actor:{kind:'HUMAN'}},{...actions,ready:async()=>({ok:true})})
