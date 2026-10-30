import {createCurrentFreshReportHost,type CurrentFreshReportRefreshOptions,type CurrentFreshReportReadOptions} from '../../current-fresh-report/src/current-fresh-report.mjs'
import type {ClerkIdentityClient} from '../../src/identity-provider.mjs'
import type {PublicIdentityApplication} from '../../src/public-request.mjs'
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
