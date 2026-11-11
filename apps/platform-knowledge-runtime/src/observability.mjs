const allowed=new Set(['BOOTSTRAP_STARTED','FOUNDATION_PROBE_OK','FOUNDATION_PROBE_FAILED','BOOTSTRAP_STOPPED']);
export function createTelemetry({config,write=line=>process.stdout.write(line+'\n'),send=()=>{}}){
 return {emit(code){
   if(!allowed.has(code))return;
   const event={event:'platform_knowledge_foundation',code,environment:config.environment,service:`platform-knowledge-${config.role}`,release:config.release};
   try{write(JSON.stringify(event));}catch{}
   if(code==='FOUNDATION_PROBE_FAILED')try{send({message:code,level:'error',tags:{environment:event.environment,service:event.service},release:event.release});}catch{}
 }};
}
export async function sentryTransport(config){
 if(!config.sentryDsn)return {send:()=>{},close:async()=>{},status:'UNCONFIGURED'};
 if(!config.sentryProject)throw new Error('SENTRY_PROJECT_BINDING_REQUIRED');
 const sdk=await import('@sentry/node');
 sdk.init({dsn:config.sentryDsn,environment:config.environment,release:config.release,defaultIntegrations:false,
   sendDefaultPii:false,tracesSampleRate:0,attachStacktrace:false,
   beforeSend:event=>({event_id:event.event_id,timestamp:event.timestamp,platform:'node',message:'FOUNDATION_PROBE_FAILED',level:'error',environment:config.environment,release:config.release,tags:{service:`platform-knowledge-${config.role}`}})});
 return {send:event=>sdk.captureEvent(event),close:()=>sdk.close(2000),status:'CONFIGURED_NOT_LIVE_VERIFIED'};
}
