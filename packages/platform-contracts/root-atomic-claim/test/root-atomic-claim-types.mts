import {createRootAtomicClaimReportHost,createRootAtomicClaimDeliveryHost} from '../src/root-atomic-claim.mjs'
import type {CommittedRootClaim} from '../src/root-atomic-claim.mjs'
declare const options:Parameters<typeof createRootAtomicClaimReportHost<object>>[0]
declare const delivery:Parameters<typeof createRootAtomicClaimDeliveryHost<object>>[0]
declare const request:Request,operation:Parameters<ReturnType<typeof createRootAtomicClaimDeliveryHost>['deliver']>[0]
const host=createRootAtomicClaimReportHost(options),worker=createRootAtomicClaimDeliveryHost(delivery)
const input={request,organisationId:'11111111-1111-4111-8111-111111111111',nip:'5272443955',idempotencyKey:null}
const actions={probe:async()=>({status:'MISS'}),refresh:async()=>({}),read:async()=>({status:'READY',value:{ok:true}}),ready:async()=>({ok:true}),work:async()=>{}}
const output:Promise<{ok:boolean}>=host.execute(input,{...actions,work:async(selection,signal)=>{
 if(selection.rootClaim)await worker.deliver(operation,selection.rootClaim)
 void signal
}})
void output
// @ts-expect-error Opaque claim cannot be constructed from plain JSON.
const forged:CommittedRootClaim={}
// @ts-expect-error No claim may be reconstructed from a wire-shaped admission.
worker.deliver(operation,{status:'READY',jobId:'forged',leaseId:'forged'})
// @ts-expect-error REPORT_ADMISSION is not this model.
createRootAtomicClaimDeliveryHost({...delivery,reportAdmission:{schemaDigest:'a'.repeat(64)}})
// @ts-expect-error No external-account cache option exists.
createRootAtomicClaimReportHost({...options,cache:true})
// @ts-expect-error Work cannot supply the disclosed report.
host.execute(input,{...actions,work:async()=>({ok:true})})
// @ts-expect-error Callback lifetime proof is optional only for Root replay; null cannot authorize deliver.
worker.deliver(operation,null)
// @ts-expect-error A raw actor is not an opening input.
host.execute({...input,actor:{kind:'HUMAN'}},actions)
