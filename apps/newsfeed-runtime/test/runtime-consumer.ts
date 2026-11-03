import type {ObservationInput,ObservationUpdate,Observation} from '../../../packages/newsfeed-contracts/index.js';
const input:ObservationInput={name:'Topic',subjectKind:'topic',subject:'investments',request:{contractVersion:'1.0.0',provider:'brave',family:'news-discovery',operation:'search',criteria:{text:'investments'}}};
const update:ObservationUpdate={version:1,status:'PAUSED'};
// @ts-expect-error A client cannot assign the persisted owner.
const forged:ObservationInput={...input,ownerUserId:'forged'};
// @ts-expect-error A Calendar request cannot become a publication observation.
const wrong:ObservationInput={...input,request:{contractVersion:'1.0.0',provider:'trading-economics',family:'economic-calendar',operation:'search',criteria:{countries:['Poland']}}};
declare const stored:Observation;
const owner:string=stored.ownerUserId,actor:string=stored.updatedByActorId;void update;void forged;void wrong;void owner;void actor;
