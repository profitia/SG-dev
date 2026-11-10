import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
export const ENVIRONMENTS=Object.freeze({
 development:{projectId:'shiny-bonus-85532609',branchId:'br-wispy-bonus-b9ohunab',databaseHost:'ep-mute-night-b9o332my-pooler.c-7.eu-central-1.aws.neon.tech',applicationId:'profitia-newsfeed-api-development'},
 staging:{projectId:'shiny-bonus-85532609',branchId:'br-frosty-cell-b9hzdh6e',databaseHost:'ep-wandering-term-b9v57pi9-pooler.c-7.eu-central-1.aws.neon.tech',applicationId:'profitia-newsfeed-api-staging'},
 production:{projectId:'twilight-wind-91374750',branchId:'br-noisy-pine-b9i0865t',databaseHost:'ep-aged-sun-b9ooczkd-pooler.c-7.eu-central-1.aws.neon.tech',applicationId:'profitia-newsfeed-api-production'}
});
export function readConfiguration(env=process.env){
 /** @returns {never} */
 const bad=name=>{throw new SourceHubError('INVALID_CONFIGURATION_'+name,503);};
 const value=name=>{const v=env[name];if(typeof v!=='string'||!v.length||/[\r\n\x00]/.test(v))bad(name);return v;};
 const environment=value('NEWSFEED_ENVIRONMENT');if(environment!=='development')bad('ENVIRONMENT_NOT_ACTIVATED');const target=ENVIRONMENTS[environment],runtimeRole='newsfeed_development_runtime';
 const origin=name=>{const v=value(name);try{const u=new URL(v);if(u.origin===v&&u.protocol==='https:'&&!u.username&&!u.password&&!u.hostname.includes('*'))return v;}catch{}bad(name);};
 const databaseUrl=value('NEWSFEED_DATABASE_URL');try{const u=new URL(databaseUrl);if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!==target.databaseHost||decodeURIComponent(u.username)!==runtimeRole||u.pathname!=='/neondb'||!['require','verify-full'].includes(u.searchParams.get('sslmode')??'')||u.hash||u.searchParams.has('options'))bad('NEWSFEED_DATABASE_URL');}catch{bad('NEWSFEED_DATABASE_URL');}
 const publicOrigin=origin('NEWSFEED_PUBLIC_ORIGIN'),sourceHubOrigin=origin('SOURCE_HUB_PUBLIC_ORIGIN');if(publicOrigin===sourceHubOrigin)bad('PEER_ORIGINS');
 const identityIssuer=origin('PROFITIA_IDENTITY_ISSUER'),authorizedParties=value('PROFITIA_AUTHORIZED_PARTIES').split(',');for(const p of authorizedParties){try{if(new URL(p).origin!==p||!p.startsWith('https://'))bad('PROFITIA_AUTHORIZED_PARTIES');}catch{bad('PROFITIA_AUTHORIZED_PARTIES');}}
 const assistantReadVersion=env.NEWSFEED_ASSISTANT_READ_VERSION??null;
 if(assistantReadVersion!==null&&(assistantReadVersion!=='newsfeed-assistant-read-v1'||publicOrigin!=='https://newsfeed-api-development.onrender.com'
  ||!authorizedParties.includes('https://dev-sg2.spendguru.app')||!authorizedParties.includes(publicOrigin)))bad('NEWSFEED_ASSISTANT_READ_VERSION');
 const clerkSecretKey=value('CLERK_SECRET_KEY'),clerkPublishableKey=value('CLERK_PUBLISHABLE_KEY');if(!clerkSecretKey.startsWith('sk_test_')||!clerkPublishableKey.startsWith('pk_test_'))bad('DEVELOPMENT_IDENTITY_CREDENTIALS');
 const k=value('SOURCE_HUB_PEER_KEY_B64'),peerKey=Buffer.from(k,'base64');if(peerKey.length<32||peerKey.length>128||peerKey.toString('base64')!==k)bad('SOURCE_HUB_PEER_KEY_B64');
 const requiredProduct=value('PROFITIA_REQUIRED_PRODUCT');if(!['SPENDGURU','SUPPLIER_INTELLIGENCE'].includes(requiredProduct))bad('PROFITIA_REQUIRED_PRODUCT');
 const port=Number(env.PORT??10000);if(!Number.isInteger(port)||port<1||port>65535||[18012,18013,19099].includes(port))bad('PORT');
 const c={environment,...target,databaseName:'neondb',runtimeRole,publicOrigin,sourceHubOrigin,identityIssuer,authorizedParties,requiredProduct,port,host:'0.0.0.0',sourceHubApplicationId:'profitia-source-hub-development',deploymentId:value('NEWSFEED_DEPLOYMENT_ID'),configurationVersion:value('NEWSFEED_CONFIGURATION_VERSION'),peerKeyId:value('SOURCE_HUB_PEER_KEY_ID'),assistantReadVersion};
 Object.defineProperty(c,'secrets',{enumerable:false,value:Object.freeze({databaseUrl,clerkSecretKey,clerkPublishableKey,peerKey})});return Object.freeze(/** @type {typeof c & {secrets:{databaseUrl:string,clerkSecretKey:string,clerkPublishableKey:string,peerKey:Buffer}}} */(c));
}
