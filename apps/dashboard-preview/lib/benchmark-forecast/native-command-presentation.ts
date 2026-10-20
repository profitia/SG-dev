import {FORECAST_PORTFOLIO_MODELS,FORECAST_TARGET_SEMANTICS,FORECAST_TARGET_BASES,resolveForecastTargetSemantics,
  type ForecastPortfolioModelId,type ForecastTargetBasis,type ForecastTargetSemantics} from './forecast-contract'

export type NativeForecastCommandSelection=Readonly<{kind:'CURRENT'|'VERIFICATION';modelId:ForecastPortfolioModelId;targetSemantics:ForecastTargetSemantics}>
export type NativeForecastCommandOutcome='ACCEPTED'|'DENIED'|'LIMIT_REACHED'|'INVALID'|'UNKNOWN'
export type NativeForecastPendingCommand=Readonly<{kind:NativeForecastCommandSelection['kind'];state:NativeForecastCommandOutcome|'SENDING'}>
export function parseNativeForecastCommand(value:unknown):NativeForecastCommandSelection|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null
  const v=value as Record<string,unknown>
  if(Object.keys(v).sort().join(',')!=='kind,modelId,targetSemantics'||!['CURRENT','VERIFICATION'].includes(v.kind as string)
    ||!FORECAST_PORTFOLIO_MODELS.includes(v.modelId as ForecastPortfolioModelId)
    ||!FORECAST_TARGET_SEMANTICS.includes(v.targetSemantics as ForecastTargetSemantics))return null
  return Object.freeze({kind:v.kind as NativeForecastCommandSelection['kind'],modelId:v.modelId as ForecastPortfolioModelId,targetSemantics:v.targetSemantics as ForecastTargetSemantics})
}
export function nativeForecastCommandFromUi(modelId:ForecastPortfolioModelId,targetBasis:ForecastTargetBasis,kind:NativeForecastCommandSelection['kind']='CURRENT'){
  if(!FORECAST_TARGET_BASES.includes(targetBasis))return null
  return parseNativeForecastCommand({kind,modelId,targetSemantics:resolveForecastTargetSemantics(targetBasis)})
}
/** Accepted private intent is deliberately not a scientific queue/readiness state. */
export function nativeForecastCommandOutcome(status:number,body:unknown):NativeForecastCommandOutcome{
  if(status===202&&body&&typeof body==='object'&&!Array.isArray(body)
    &&Object.keys(body).join(',')==='status'&&'status'in body&&body.status==='ACCEPTED')return'ACCEPTED'
  if(status===401||status===403)return'DENIED'
  if(status===429)return'LIMIT_REACHED'
  if(status===400)return'INVALID'
  return'UNKNOWN'
}

/** Presentation invalidation only. An accepted intent is not a prepared result
 * or an access grant; each resulting read still uses the protected host port. */
export function nativeForecastCompletionPlan(input:{modelId:ForecastPortfolioModelId;targetBasis:ForecastTargetBasis;
  currentReadiness?:string;fullVerificationReadiness?:string;pending:NativeForecastPendingCommand|null}){
  const completed:NativeForecastCommandSelection[]=[]
  for(const kind of ['CURRENT','VERIFICATION'] as const){
    const ready=kind==='CURRENT'?input.currentReadiness==='READY':input.fullVerificationReadiness==='READY'
    const command=ready?nativeForecastCommandFromUi(input.modelId,input.targetBasis,kind):null
    if(command)completed.push(command)
  }
  const pending=input.pending,observing=pending?.state==='ACCEPTED'||pending?.state==='UNKNOWN'
  const validPending=pending?nativeForecastCommandFromUi(input.modelId,input.targetBasis,pending.kind):null
  const clearPending=!!pending&&pending.state!=='SENDING'&&completed.some(command=>command.kind===pending.kind)
  return {completed,clearPending,
    poll:!!validPending&&observing&&!clearPending,
    refreshCurrent:clearPending&&observing&&(pending?.kind==='CURRENT'||input.targetBasis==='POINT_IN_TIME')}
}
