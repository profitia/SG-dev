import {createReportRunner} from './runner.mjs';import {createReportApi} from './api.mjs';import {createScheduler} from './scheduler.mjs';import {requireThat} from '../../../packages/insights-contracts/index.mjs';
/** Boot once inside the existing approved host, not a new web service. The
 * host supplies its current E1 boundaries and existing Sentry callbacks. */
export function createInsightsRuntime({configuration,store,authority,sources,canonical,composer,quality,renderer,telemetry,now}){
 requireThat(configuration.environment==='development','DEVELOPMENT_ONLY');
 const runner=createReportRunner({store,authority,sources,canonical,composer,quality,renderer,telemetry,now});
 const scheduler=createScheduler({runner,authority,definitions:configuration.definitions,profiles:configuration.profiles,now});
 const api=createReportApi({runner,store,authority,profiles:configuration.profiles,now});
 let stopping=false;
 return {runner,api,scheduler,async tick(options){requireThat(configuration.enabled&&configuration.authorityDecisionRef,'WAITING_AUTHORIZATION');await scheduler.tick(options);for(const context of await authority.workerContexts()){const id=await store.queued(context.organisationId);if(id)await runner.run(context.organisationId,id)}},
 async serveWorker({signal,intervalMs=30000}){while(!signal.aborted&&!stopping){await this.tick();await new Promise(resolve=>{const t=setTimeout(resolve,intervalMs);signal.addEventListener('abort',()=>{clearTimeout(t);resolve()},{once:true})})}},stop(){stopping=true}}
}
