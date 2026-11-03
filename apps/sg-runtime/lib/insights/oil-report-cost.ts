import {OIL_REPORT_PROFILE as p} from './oil-report-profile'
export function oilReportCostReservation(inputTokens:number){
 if(!Number.isSafeInteger(inputTokens)||inputTokens<1||inputTokens>p.maximumInputTokens)throw Error('REPORT_TOKEN_LIMIT')
 // Conservative cache-write input price, Standard only. 10^-7 USD integer units.
 const upperMicroUsd=Math.ceil((inputTokens*25+p.maximumOutputTokens*100)/10)
 if(upperMicroUsd>p.reservationMicroUsd)throw Error('REPORT_COST_LIMIT')
 return {currency:'USD' as const,reservationMicroUsd:p.reservationMicroUsd,upperMicroUsd,attempts:1 as const,retryAllowed:false as const,unknownUsageReleasesHold:false as const,providerInvoiceCost:'UNKNOWN' as const}
}
