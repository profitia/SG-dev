import {dueSlot,validateSchedule} from './calendar.mjs';
import {requireThat} from '../../../packages/insights-contracts/index.mjs';
export function createScheduler({runner,authority,definitions,profiles,now=()=>new Date().toISOString()}){return {async tick({controlled=false}={}){const results=[];for(const d of definitions){validateSchedule(d.schedule);if(!d.schedule.enabled&&!controlled)continue;
 const slot=dueSlot(now(),{...d.schedule,enabled:true});if(!slot)continue;
 const context=await authority.schedulerContext(d);requireThat(context.actorKind==='SERVICE','SERVICE_REQUIRED');
 const input={definitionId:d.id,profileVersion:d.profileVersion,revision:d.revision,period:slot.period,asOf:now(),allowPartial:false};
 // Manual and scheduled triggers use exactly the same edition key/start path.
 results.push(await runner.start(context,input,profiles[d.profileVersion],'SCHEDULE'));}return results}}}
