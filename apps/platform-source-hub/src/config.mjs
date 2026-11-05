import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
export const ENVIRONMENTS=Object.freeze({
 development:{projectId:'delicate-queen-44677134',branchId:'br-orange-salad-ba2llks7',host:'ep-noisy-darkness-barhqoqw-pooler.c-8.eu-central-1.aws.neon.tech',applicationId:'profitia-source-hub-development'},
 staging:{projectId:'delicate-queen-44677134',branchId:'br-snowy-breeze-bahrkgrr',host:'ep-noisy-grass-baszxszx-pooler.c-8.eu-central-1.aws.neon.tech',applicationId:'profitia-source-hub-staging'},
 production:{projectId:'crimson-band-46697896',branchId:'br-flat-resonance-b9dh28bf',host:'ep-empty-water-b9yjwui8-pooler.c-7.eu-central-1.aws.neon.tech',applicationId:'profitia-source-hub-production'}
});
/** @returns {never} */
const bad=name=>{throw new SourceHubError('INVALID_CONFIGURATION_'+name,503);};
export function readConfiguration(env=process.env){
 const environment=env.SOURCE_HUB_ENVIRONMENT;if(environment!=='development')bad('ENVIRONMENT_NOT_ACTIVATED');const target=ENVIRONMENTS[environment];
 const value=name=>{const v=env[name];if(typeof v!=='string'||!v.length||/[\r\n\x00]/.test(v))bad(name);return v;};
 const origin=name=>{const v=value(name);try{const u=new URL(v);if(u.origin===v&&u.protocol==='https:'&&!u.username&&!u.password&&!u.hostname.includes('*'))return v;}catch{}bad(name);};
 const database=(name,role)=>{const v=value(name);try{const u=new URL(v);if(['postgres:','postgresql:'].includes(u.protocol)&&u.hostname===target.host&&decodeURIComponent(u.username)===role&&u.pathname==='/neondb'&&!u.hash&&['require','verify-full'].includes(u.searchParams.get('sslmode')??'')&&!u.searchParams.has('options'))return v;}catch{}bad(name);};
 const runtimeRole='source_hub_development_runtime',sourceRole='source_hub_development_source_runtime';
 const privateUrl=database('SOURCE_HUB_DATABASE_URL',runtimeRole),sourceUrl=database('SOURCE_HUB_SOURCE_DATABASE_URL',sourceRole);
 const publicOrigin=origin('SOURCE_HUB_PUBLIC_ORIGIN'),callerOrigin=origin('NEWSFEED_PUBLIC_ORIGIN');if(publicOrigin===callerOrigin)bad('PEER_ORIGINS');
 const identityIssuer=origin('PROFITIA_IDENTITY_ISSUER');
 const secretKey=value('CLERK_SECRET_KEY'),publishableKey=value('CLERK_PUBLISHABLE_KEY');if(!secretKey.startsWith('sk_test_')||!publishableKey.startsWith('pk_test_'))bad('DEVELOPMENT_IDENTITY_CREDENTIALS');
 const peerKey=value('SOURCE_HUB_PEER_KEY_B64');const peerBytes=Buffer.from(peerKey,'base64');if(peerBytes.length<32||peerBytes.length>128||peerBytes.toString('base64')!==peerKey)bad('SOURCE_HUB_PEER_KEY_B64');
 const parties=value('PROFITIA_AUTHORIZED_PARTIES').split(',');for(const p of parties){try{if(new URL(p).origin!==p||!p.startsWith('https://'))bad('PROFITIA_AUTHORIZED_PARTIES');}catch{bad('PROFITIA_AUTHORIZED_PARTIES');}}
 const product=value('PROFITIA_REQUIRED_PRODUCT');if(!['SPENDGURU','SUPPLIER_INTELLIGENCE'].includes(product))bad('PROFITIA_REQUIRED_PRODUCT');
 const extraNames=['SOURCE_HUB_ADDITIONAL_PEER_APPLICATION_ID','SOURCE_HUB_ADDITIONAL_PEER_ORIGIN','SOURCE_HUB_ADDITIONAL_PEER_KEY_ID','SOURCE_HUB_ADDITIONAL_PEER_KEY_B64','SOURCE_HUB_ADDITIONAL_PEER_EXPIRES_AT'];
 let additionalPeer=null,additionalPeerKey=null,additionalPeerKeyB64=null;
 if(extraNames.some(name=>env[name]!==undefined)){
  const [appId,,keyId,,expiresAt]=extraNames.map(value),sourceOrigin=origin(extraNames[1]);
  const raw=value(extraNames[3]),bytes=Buffer.from(raw,'base64');
  if(![appId,keyId].every(v=>/^[a-z][a-z0-9-]{1,63}$/.test(v))||[target.applicationId,'profitia-newsfeed-api-development'].includes(appId)
   ||sourceOrigin===publicOrigin||!parties.includes(sourceOrigin)||keyId===value('SOURCE_HUB_PEER_KEY_ID')
   ||bytes.length<32||bytes.length>128||bytes.toString('base64')!==raw||bytes.equals(peerBytes)
   ||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now()||Date.parse(expiresAt)>Date.now()+86400000)bad('ADDITIONAL_PEER');
  additionalPeer=Object.freeze({applicationId:appId,sourceOrigin,keyId,expiresAt});additionalPeerKey=bytes;additionalPeerKeyB64=raw;
 }
 const port=Number(env.PORT??10000);if(!Number.isInteger(port)||port<1||port>65535||[18012,18013,19099].includes(port))bad('PORT');
 const configuration={environment,...target,databaseName:'neondb',runtimeRole,sourceRole,publicOrigin,callerOrigin,port,host:'0.0.0.0',identityIssuer,authorizedParties:parties,requiredProduct:product,
  callerApplicationId:'profitia-newsfeed-api-development',deploymentId:value('SOURCE_HUB_DEPLOYMENT_ID'),configurationVersion:value('SOURCE_HUB_CONFIGURATION_VERSION'),peerKeyId:value('SOURCE_HUB_PEER_KEY_ID'),...(additionalPeer?{additionalPeer}:{})};
 Object.defineProperty(configuration,'secrets',{enumerable:false,value:Object.freeze({databaseUrl:privateUrl,sourceDatabaseUrl:sourceUrl,clerkSecretKey:secretKey,clerkPublishableKey:publishableKey,peerKey:peerBytes,
  newsapi:env.SOURCE_HUB_DEVELOPMENT_NEWSAPI_API_KEY??null,brave:env.SOURCE_HUB_DEVELOPMENT_BRAVE_API_KEY??null,tradingEconomics:env.SOURCE_HUB_DEVELOPMENT_TRADING_ECONOMICS_API_KEY??null,...(additionalPeer?{additionalPeerKey,additionalPeerKeyB64}:{})})});
 return Object.freeze(/** @type {typeof configuration & {secrets:{databaseUrl:string,sourceDatabaseUrl:string,clerkSecretKey:string,clerkPublishableKey:string,peerKey:Buffer,newsapi:string|null,brave:string|null,tradingEconomics:string|null,additionalPeerKey?:Buffer,additionalPeerKeyB64?:string}}} */(configuration));
}
