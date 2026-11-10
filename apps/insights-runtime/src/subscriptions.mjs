import {parseSubscription,SUBSCRIPTION_CONTRACT} from '@profitia/insights-contracts/subscriptions';
import {requireThat} from '@profitia/insights-contracts';
import {scheduledInstant,localParts,addDays} from './calendar.mjs';
export {parseSubscription,SUBSCRIPTION_CONTRACT};
export function nextReportOccurrence(schedule,after){
 if(schedule===null)return null;
 requireThat(schedule.timeZone==='Europe/Warsaw'&&Number.isFinite(Date.parse(after)),'UNSUPPORTED_REPORT_TIME_ZONE',400);
 let start=localParts(after).date;if(start<schedule.startDate)start=schedule.startDate;
 for(let n=0;n<15;n++){
  const date=addDays(start,n);if(schedule.endDate&&date>schedule.endDate)return null;
  if(new Date(date).getUTCDay()!==schedule.weekday)continue;
  const instant=scheduledInstant(date,schedule.localTime);
  if(Date.parse(instant)>Date.parse(after))return {at:instant,key:date+'T'+schedule.localTime+'@'+schedule.timeZone};
 }return null;
}
/** A catalogue of installed producers, not a list of illustrative markets. */
export function installedReportProfiles(configuration){
 requireThat(configuration?.environment==='development'&&Array.isArray(configuration.definitions),'REPORT_CONFIGURATION_REQUIRED',503);
 if(!configuration.enabled||!configuration.authorityDecisionRef)return [];
 return configuration.definitions.filter(d=>d.id==='oil-asphalt'&&configuration.profiles[d.profileVersion]).map(d=>({
  definitionId:d.id,profileVersion:d.profileVersion,label:'Oil & Asphalt Market Outlook',description:'Analiza rynku ropy i asfaltu przygotowywana przez właściwy proces raportowy.',
  availability:'AVAILABLE',subjectMode:'NONE',cadences:['ONCE','WEEKLY'],timeZones:['Europe/Warsaw'],deliveryChannels:['ASSISTANT'],
  sections:['Executive Summary','Rynek i dane','Wydarzenia','Perspektywy i ograniczenia'],publicationRequiresReview:true,
 }));
}
