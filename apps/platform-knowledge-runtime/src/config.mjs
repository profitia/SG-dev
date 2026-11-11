export function loadConfig(env,role){
 if(env.PK_ENVIRONMENT!=='development'||!['api','worker'].includes(role))throw new Error('INVALID_ENVIRONMENT_OR_ROLE');
 if(env.PK_PROCESSING_ENABLED && env.PK_PROCESSING_ENABLED!=='false')throw new Error('ENGINE_NOT_IMPLEMENTED');
 const expectedRole=`platform_knowledge_${role}`;
 let database;try{database=new URL(env.DATABASE_URL);}catch{throw new Error('DATABASE_BINDING_REQUIRED');}
 if(!['postgres:','postgresql:'].includes(database.protocol)||decodeURIComponent(database.username)!==expectedRole
   ||database.pathname!=='/platform_knowledge'||database.hostname!==env.PK_DATABASE_HOST
   ||!/^ep-[a-z0-9-]+(?:-pooler)?\.c-[0-9]+\.eu-central-1\.aws\.neon\.tech$/.test(database.hostname)
   ||!['require','verify-full'].includes(database.searchParams.get('sslmode')))throw new Error('DATABASE_BINDING_REJECTED');
 if(!env.PK_NEON_PROJECT_ID||!/^br-[a-z0-9-]+$/.test(env.PK_NEON_BRANCH_ID??''))throw new Error('NEON_BINDING_REQUIRED');
 const release=env.RENDER_GIT_COMMIT??env.PK_RELEASE_SHA;
 if(!/^[a-f0-9]{40}$/.test(release??''))throw new Error('EXACT_RELEASE_REQUIRED');
 const port=Number(env.PORT??10000);if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('INVALID_PORT');
 return Object.freeze({role,environment:'development',release,port,expectedRole,databaseUrl:env.DATABASE_URL,
   sentryDsn:env.SENTRY_DSN||null,sentryProject:env.PK_SENTRY_PROJECT||null,processingEnabled:false});
}
