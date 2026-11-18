export function loadConfig(env,role){
 if(env.PK_ENVIRONMENT!=='development'||!['api','worker'].includes(role))throw new Error('INVALID_ENVIRONMENT_OR_ROLE');
 if(env.PK_PROCESSING_ENABLED && !['false','true'].includes(env.PK_PROCESSING_ENABLED))throw new Error('INVALID_ENGINE_FLAG');
 const enabled=env.PK_PROCESSING_ENABLED==='true';
 const expectedRole=`platform_knowledge_${role}`;
 let database;try{database=new URL(env.DATABASE_URL);}catch{throw new Error('DATABASE_BINDING_REQUIRED');}
 if(!['postgres:','postgresql:'].includes(database.protocol)||decodeURIComponent(database.username)!==expectedRole
   ||database.pathname!=='/platform_knowledge'||database.hostname!==env.PK_DATABASE_HOST
   ||!/^ep-[a-z0-9-]+(?:-pooler)?\.c-[0-9]+\.eu-central-1\.aws\.neon\.tech$/.test(database.hostname)
   ||!['require','verify-full'].includes(database.searchParams.get('sslmode')))throw new Error('DATABASE_BINDING_REJECTED');
 if(!env.PK_NEON_PROJECT_ID||!/^br-[a-z0-9-]+$/.test(env.PK_NEON_BRANCH_ID??''))throw new Error('NEON_BINDING_REQUIRED');
 if(enabled&&(env.PK_NEON_PROJECT_ID!=='sparkling-sky-79692560'||env.PK_NEON_BRANCH_ID!=='br-billowing-grass-b9ko5s4f'
  ||database.searchParams.get('sslmode')!=='verify-full'||!env.OPENAI_API_KEY||!env.PK_S3_ENDPOINT
  ||env.PK_OPENAI_STARTUP_BUDGET_USD!=='10'||env.PK_OPENAI_DOCUMENT_LIMIT_USD!=='1'
  ||role==='worker'&&(!env.PK_E1_WORKER_KEY_ID||!env.PK_E1_WORKER_PRIVATE_KEY)))throw Error('ENGINE_BINDING_REQUIRED');
 const release=env.RENDER_GIT_COMMIT??env.PK_RELEASE_SHA;
 if(!/^[a-f0-9]{40}$/.test(release??''))throw new Error('EXACT_RELEASE_REQUIRED');
 const port=Number(env.PORT??10000);if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('INVALID_PORT');
 let clerkFrontendOrigin=null;
 if(env.PK_CLERK_PUBLISHABLE_KEY){
  if(!/^pk_test_[A-Za-z0-9+/=_-]+$/.test(env.PK_CLERK_PUBLISHABLE_KEY))throw Error('DEVELOPMENT_CLERK_REQUIRED');
  const host=Buffer.from(env.PK_CLERK_PUBLISHABLE_KEY.slice(8),'base64').toString('utf8').replace(/\$$/,'');
  if(!/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(host))throw Error('CLERK_FRONTEND_BINDING_REQUIRED');clerkFrontendOrigin='https://'+host;
 }
 return Object.freeze({role,environment:'development',release,port,expectedRole,databaseUrl:env.DATABASE_URL,
   sentryDsn:env.SENTRY_DSN||null,sentryProject:env.PK_SENTRY_PROJECT||null,processingEnabled:enabled,
   origin:'https://platform-knowledge-development-api.onrender.com',clerkPublishableKey:env.PK_CLERK_PUBLISHABLE_KEY??null,clerkFrontendOrigin});
}
