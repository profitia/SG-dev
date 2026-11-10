import {requireThat} from './index.mjs';
export const SUBSCRIPTION_CONTRACT='procurement-insights.subscription/1.0.0';
export const PUBLISHED_EDITION_CONTRACT='procurement-insights.published-edition/1.0.0';
const closed=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function parseSubscription(value,profile,{partial=false}={}){
 requireThat(closed(value,['contractVersion','name','definitionId','profileVersion','subjectRef','schedule','notifications',...(partial?['version','status']:[])])&&value.contractVersion===SUBSCRIPTION_CONTRACT,'INVALID_SUBSCRIPTION',400);
 requireThat(profile&&value.definitionId===profile.definitionId&&value.profileVersion===profile.profileVersion&&profile.availability==='AVAILABLE','PROFILE_NOT_AVAILABLE',409);
 requireThat(typeof value.name==='string'&&value.name.trim().length>=1&&value.name.length<=200,'INVALID_SUBSCRIPTION_NAME',400);
 requireThat(value.subjectRef===null&&profile.subjectMode==='NONE'||closed(value.subjectRef,['kind','key'])&&profile.subjectMode==='REFERENCE'&&profile.subjectKinds?.includes(value.subjectRef.kind)&&typeof value.subjectRef.key==='string'&&value.subjectRef.key.length>0&&value.subjectRef.key.length<=200,'INVALID_REPORT_SUBJECT',400);
 let schedule=null;
 if(value.schedule!==null){const s=value.schedule;
  requireThat(closed(s,['frequency','weekday','localTime','timeZone','startDate','endDate'])&&s.frequency==='WEEKLY'&&profile.cadences.includes('WEEKLY')&&Number.isSafeInteger(s.weekday)&&s.weekday>=0&&s.weekday<=6&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.localTime??'')&&profile.timeZones.includes(s.timeZone)&&day(s.startDate)&&(s.endDate===null||day(s.endDate)&&s.endDate>=s.startDate),'INVALID_REPORT_SCHEDULE',400);
  schedule={frequency:'WEEKLY',weekday:s.weekday,localTime:s.localTime,timeZone:s.timeZone,startDate:s.startDate,endDate:s.endDate};
 }else requireThat(profile.cadences.includes('ONCE'),'CADENCE_NOT_AVAILABLE',400);
 requireThat(closed(value.notifications,['assistant','email'])&&typeof value.notifications.assistant==='boolean'&&typeof value.notifications.email==='boolean','INVALID_NOTIFICATION_PREFERENCES',400);
 if(value.notifications.email)requireThat(profile.deliveryChannels.includes('EMAIL'),'EMAIL_DELIVERY_NOT_ADMITTED',409);
 if(partial)requireThat(Number.isSafeInteger(value.version)&&value.version>=1&&['ACTIVE','PAUSED','ENDED'].includes(value.status),'INVALID_SUBSCRIPTION_VERSION',400);
 return {contractVersion:SUBSCRIPTION_CONTRACT,name:value.name.trim(),definitionId:profile.definitionId,profileVersion:profile.profileVersion,subjectRef:value.subjectRef,schedule,notifications:{...value.notifications},...(partial?{version:value.version,status:value.status}:{})};
}
