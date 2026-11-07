// SYNTHETIC_ONLY. Extend the accepted isolated current-E1 fixture, never a live
// directory, session, grant, key, provider or product database.
import fs from 'node:fs'
import {createHash,generateKeyPairSync,randomUUID} from 'node:crypto'
import {currentE1Fixture,U,V,A,B} from './current-e1-authority-postgres.mjs'
import {createFirstPartySourceSigner,createFirstPartySourceHost} from '../../current-e1-authority/first-party.mjs'
const load=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8')
const digest=s=>createHash('sha256').update(s).digest('hex')
export {U,V,A,B}
export async function firstPartyFixture(){
 const f=await currentE1Fixture(),targetOrigin='https://hub.synthetic.test',role='synthetic_report_'+randomUUID().replaceAll('-','').slice(0,24),reportApp='synthetic-procurement-insights',serviceId=randomUUID(),grantId=randomUUID()
 const components={newsfeed:{id:'synthetic-newsfeed-component',app:f.apps[2],role:'newsfeed_development_runtime',origin:f.origin,key:generateKeyPairSync('ed25519')},
  report:{id:'synthetic-procurement-report-component',app:reportApp,role,origin:'urn:profitia:service:synthetic-report:development',key:generateKeyPairSync('ed25519')}}
 try{
  await f.databases[0].query("CREATE ROLE "+role+" LOGIN PASSWORD 'SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION")
  await f.asOwner(0,async c=>{
   const services=load('../../migrations/access/005-service-read.sql');await c.query(services)
   await c.query("INSERT INTO profitia_services.installation(singleton,schema_version,schema_digest,source_ref) VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[digest(services)])
   await c.query(load('../../current-e1-authority/migrations/003-first-party-authority.sql'))
   await c.query("UPDATE profitia_access.product_grants SET features=ARRAY['benchmark','market'] WHERE application_id='spendguru'")
   await c.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[reportApp])
   for(const x of Object.values(components))await c.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')",[x.role,x.app])
   await c.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'SPENDGURU_SAAS','SYNTHETIC_ONLY','synthetic-first-party-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[role,randomUUID(),serviceId])
   await c.query("INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'knowledge.read','market',NULL,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[grantId,role,A])
   for(const org of[A,B])await c.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id) VALUES($1,'spendguru',$2,$3,'ALLOW','knowledge.read','market',NULL)",[randomUUID(),org,U])
   await c.query("INSERT INTO profitia_e1_authority.source_receivers(application_id,target_origin,product_application_id,status,source_ref,expires_at) VALUES($1,$2,'spendguru','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[f.apps[1],targetOrigin])
   for(const x of Object.values(components))await c.query("INSERT INTO profitia_e1_authority.source_components(component_id,key_id,application_id,login_role,receiver_application_id,source_origin,public_key,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,'synthetic-key',$2,$3,$4,$5,$6,'SYNTHETIC_ONLY','synthetic-first-party-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[x.id,x.app,x.role,f.apps[1],x.origin,x.key.publicKey.export({type:'spki',format:'pem'})])
  })
  await f.asOwner(1,async c=>{await c.query(load('../../current-e1-authority/migrations/004-first-party-receiver.sql'));await c.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_e1_receiver TO source_hub_development_runtime')})
  await f.asOwner(1,async c=>{
   await c.query(load('../../../../apps/platform-source-hub/migrations/002-te-news.sql'))
   await c.query(load('../../../../apps/platform-source-hub/migrations/004-universal-consumers.sql'))
   await c.query('CREATE TABLE source_hub.migrations(version text PRIMARY KEY,digest text NOT NULL)')
   for(const version of ['002-te-news','004-universal-consumers'])await c.query('INSERT INTO source_hub.migrations VALUES($1,$2)',[version,digest(load('../../../../apps/platform-source-hub/migrations/'+version+'.sql'))])
   await c.query('GRANT SELECT ON source_hub.migrations TO source_hub_development_runtime')
   for(const [provider,family]of [['newsapi','news-discovery'],['brave','news-discovery'],...['news-discovery','economic-calendar','indicators','external-forecasts'].map(x=>['trading-economics',x])])await c.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at,consumer_access_mode) VALUES($1,$2,'SYNTHETIC_ONLY',1,$3,$4,$5,true,ARRAY['synthetic-legacy-only'],0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',now()+interval '1 hour','SPENDGURU_PRODUCT')",[provider,family,'source-hub.'+provider+'.'+family,'api.'+provider+'.'+family,randomUUID()])
  },'source_hub_development_owner')
  const transportState={calls:0,afterInitial:null,offline:false,proof:null}
  const transport=async(url,options={})=>{
   if(url!==f.authorityOrigin+'/v1/e1/source/ready'&&url!==f.authorityOrigin+'/v1/e1/source/authorize')throw Error('REAL_NETWORK_FORBIDDEN')
   if(transportState.offline)throw Error('SYNTHETIC_OUTAGE')
   if(url.endsWith('/ready'))return Response.json({ready:await f.authority.sourceReady()})
   transportState.calls++;const input=JSON.parse(options.body)
   try{const proof=await f.authority.authorizeSource(new Request(url,{method:'POST',headers:options.headers}),input);transportState.proof=proof
    if(input.previous===null&&transportState.afterInitial)await transportState.afterInitial()
    return Response.json(proof)
   }catch(error){transportState.failure=error;return Response.json({error:'SYNTHETIC_DENIAL'},{status:403})}
  }
  const application={...f.application(1),publicOrigin:targetOrigin},host=createFirstPartySourceHost({application,binding:f.bindings[1],independentQuery:f.db(1).query,transact:f.db(1).transact,fetch:transport})
  const makeSigned=async({component='report',kind='SERVICE',organisationId=A,token='SYNTHETIC_A',resource='newsapi.news-discovery',idempotencyKey='synthetic-request-'+randomUUID(),grant=grantId,command:override}={})=>{
   const x=components[component],configuration={environment:'development',componentId:x.id,consumerApplicationId:x.app,receiverApplicationId:f.apps[1],sourceOrigin:x.origin,targetOrigin,keyId:'synthetic-key',privateKey:x.key.privateKey}
   const execution={kind,organisationId,...(kind==='SERVICE'?{grantId:grant}:{})},[provider,family]=resource.split('.'),command={contractVersion:'1.0.0',provider,family,operation:'search',criteria:provider==='newsapi'?{mode:'articles',text:'SYNTHETIC_ONLY'}:{text:'SYNTHETIC_ONLY'}}
   if(override)Object.assign(command,override)
   const request=await createFirstPartySourceSigner(configuration)(new Request(targetOrigin+'/v1/acquire',{method:'POST',headers:{'content-type':'application/json','idempotency-key':idempotencyKey,...(kind==='HUMAN'?{authorization:'Bearer '+token}:{})},body:JSON.stringify({context:execution,request:command})}))
   return {request,execution,resourceId:'api.'+resource,command,configuration}
  }
  return {...f,components,serviceId,grantId,host,targetOrigin,makeSigned,sourceTransport:transport,sourceTransportState:transportState}
 }catch(error){await f.close();throw error}
}
