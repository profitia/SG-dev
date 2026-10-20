import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {randomUUID} from 'node:crypto'
import {createPrivateFinderFixture,createSourceFinderFixture,createMetadataFinderFixture} from './fixtures/benchmark-discovery-hosts.mjs'
import {createSg2DiscoveryApi} from '../lib/benchmark/discovery-api.ts'
import {createDiscoveryHttpHandler} from '../lib/benchmark/discovery-http.ts'
import {OPERATION_CONTRACT} from '../../../packages/platform-contracts/src/operation-context.mjs'
import {discoveryResultResourceId,readPrivateDiscovery} from '../lib/benchmark/discovery-operation.ts'

test('all six real Finder HTTP flows compose actual ordinary PostgreSQL, original business algorithms, native Source and a fresh private read',async t=>{
 let p,s,m,server,clarify=false
 const series='fixture_steel_index'
 try{
  p=await createPrivateFinderFixture()
  s=await createSourceFinderFixture(async(req,res,body)=>{
   if(req.url==='/mbauth/connect/token'){res.end(JSON.stringify({access_token:'fixture-returned-access',expires_in:3600}));return}
   const parsed=body?JSON.parse(body):null
   if(req.url==='/v1/responses'){
    const intent={concept:'steel',searchTerms:['steel price'],region:null,market:null,instrumentType:null,currency:null,frequency:null,useCase:null,industryContext:null,interpretation:'Steel price benchmark',confidence:clarify?0.1:0.9}
    const value=parsed.text?.format?.name==='benchmark_candidate_ranking'?{matches:[{candidateId:'macrobond:'+series,score:0.9,reason:'Relevant steel market index'}]}:intent
    res.end(JSON.stringify({id:'resp_fixture',object:'response',created_at:Math.floor(Date.now()/1000),model:'fixture-model',status:'completed',output:[{id:'msg_fixture',type:'message',status:'completed',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value),annotations:[]}]}]}));return
   }
   const row={Name:series,Title:'Fixture steel index',Description:'Synthetic market knowledge',Region:'PL'}
   if(req.url==='/v1/series/fetchentities')res.end(JSON.stringify(parsed.map(({name})=>({metadata:{...row,Name:name}}))))
   else if(req.url.startsWith('/v1/search/'))res.end(JSON.stringify({results:[row]}))
   else if(req.url.startsWith('/v1/metadata/getattributeinformation'))res.end(JSON.stringify([{description:'Synthetic metadata',canListValues:true,appliesTo:['TimeSeries']}]))
   else if(req.url.startsWith('/v1/metadata/listattributevalues'))res.end(JSON.stringify([]))
   else assert.fail('Unexpected original provider URL '+req.url)
  })
  m=await createMetadataFinderFixture()
  process.env.MACROBOND_CLIENT_ID=s.credentials.macrobondClientId;process.env.MACROBOND_CLIENT_SECRET=s.credentials.macrobondClientSecret
  process.env.OPENAI_API_KEY=s.credentials.openAiKey;process.env.OPENAI_MODEL=s.credentials.openAiModel
  const api=createSg2DiscoveryApi({...p,providerPorts:key=>({...s.create(key),loadMetadataClient:m.load})})
  const runtime=()=>({provider:'clerk',defaultOrganisationId:p.org,benchmarkDiscovery:async()=>api})
  const handle=(kind,method)=>createDiscoveryHttpHandler(kind,method,runtime,async()=>assert.fail('No legacy fallback'))
  const handlers={search:{GET:handle('SEARCH','GET'),POST:handle('SEARCH','POST')},metadata:{GET:handle('METADATA','GET')},values:{GET:handle('METADATA_VALUES','GET')},context:{POST:handle('CONTEXT','POST')},'ai-search':{POST:handle('AI_SEARCH','POST')}}
  server=http.createServer(async(req,res)=>{
   try{
    let body='';for await(const chunk of req)body+=chunk
    const url=new URL(req.url,p.origin),part=/^\/api\/benchmark\/metadata\/([^/]+)\/values$/.exec(url.pathname)
    const name=part?'values':url.pathname.split('/')[3],handler=handlers[name]?.[req.method]
    if(!handler){res.writeHead(404);res.end();return}
    const request=new Request(url,{method:req.method,headers:req.headers,...(body?{body}:{})})
    const response=await handler(request,part?{params:{metadataKey:decodeURIComponent(part[1])}}:undefined)
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))
   }catch{res.writeHead(500);res.end('Fixture unavailable')}
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  const origin='http://127.0.0.1:'+server.address().port
  const send=(path,body=null,key='finder_'+randomUUID(),user=p.user)=>fetch(origin+path,{method:body?'POST':'GET',headers:{authorization:'Bearer external-'+user,'x-profitia-idempotency-key':key,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
  const requests=[['GET search','/api/benchmark/search?q=steel%20price',null],['POST search','/api/benchmark/search',{exactSeriesId:series}],['metadata','/api/benchmark/metadata',null],['metadata values','/api/benchmark/metadata/Region/values?q=pol',null],['context','/api/benchmark/context',{seriesIds:[series]}],['AI','/api/benchmark/ai-search',{prompt:'steel price for procurement'}]]
  for(const[name,path,body]of requests)await t.test(name+' returns the original DTO only through a fresh HUMAN read',async()=>{
   const before=s.hits(),key='finder_'+randomUUID(),response=await send(path,body,key)
   assert.equal(response.status,200,await response.clone().text());assert.equal(response.headers.get('x-profitia-discovery-projection'),'sg2-private-discovery-result-v1')
   assert.equal(response.headers.get('cache-control'),'private, no-store');const dto=await response.json()
   if(name==='metadata')assert.equal(dto.items[0].key,'Region')
   else if(name==='metadata values')assert.deepEqual(dto,{items:[{value:'PL',label:'Poland'}],totalCount:2,filteredCount:1,query:'pol',limited:false})
   else if(name==='context')assert.equal(dto.items[series].primaryTitle,'Synthetic market knowledge')
   else if(name==='AI'){assert.equal(dto.intent.concept,'steel');assert.equal(dto.candidates[0].candidateId,'macrobond:'+series)}
   else assert.equal(dto.items[0].providerSeries.providerSeriesId,series)
   if(name.startsWith('metadata'))assert.equal(s.hits(),before,'Stored shared ORM must not trigger HTTP')
   else assert.ok(s.hits()>before,'Original algorithm must use actual admitted HTTP')
   const after=s.hits(),repeat=await send(path,body,key);assert.equal(repeat.status,200);assert.deepEqual(await repeat.json(),dto);assert.equal(s.hits(),after,'Replay cannot repurchase provider work')
  })
  await t.test('private stored results remain inaccessible to another member and organisation',async()=>{
   const row=(await p.owner.query('SELECT request_id FROM profitia_benchmark_discovery.results LIMIT 1')).rows[0]
   for(const[user,org]of[[p.otherUser,p.org],[p.user,p.otherOrg]])await assert.rejects(p.readHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'benchmark.discovery.read',organisationId:org,resourceId:discoveryResultResourceId(row.request_id),payload:{requestId:row.request_id},request:new Request(p.origin+'/api/benchmark/search',{headers:{authorization:'Bearer external-'+user}})},readPrivateDiscovery))
   assert.equal((await p.prisma.$queryRawUnsafe('SELECT count(*)::int n FROM profitia_benchmark_discovery.results'))[0].n,0)
  })
  await t.test('forged identity, wrong organisation and alternate paths never purchase HTTP',async()=>{
   const before=s.hits()
   assert.equal((await send('/api/benchmark/search?q=steel',null,undefined,randomUUID())).status,401)
   assert.equal((await send('/api/benchmark/search?q=steel&organisationId='+randomUUID())).status,403)
   assert.equal((await send('/api/benchmark/search/extra?q=steel')).status,400)
   assert.equal((await send('/api/benchmark/search',{query:'steel',actorId:p.user})).status,400);assert.equal(s.hits(),before)
  })
  await t.test('current read revocation withholds even an already stored successful response',async()=>{
   const path='/api/benchmark/search?q=revocation',key='finder_'+randomUUID();assert.equal((await send(path,null,key)).status,200);const before=s.hits()
   await p.controlled(()=>p.owner.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE user_id=$1 AND operation='benchmark.discovery.read'",[p.user]))
   assert.equal((await send(path,null,key)).status,403);assert.equal(s.hits(),before)
   await p.controlled(()=>p.owner.query("UPDATE profitia_access.permission_grants SET effect='ALLOW' WHERE user_id=$1 AND operation='benchmark.discovery.read'",[p.user]))
  })
  await t.test('missing HUMAN/native/Source audit prevents publication and provider work',async()=>{
   for(const[db,ownerRole,schema,role]of[[p,'profitia_access_owner','profitia_access',p.role],[p,'profitia_access_owner','profitia_jobs',p.workRole],[s,'profitia_ingestion_owner','profitia_ingestion',s.role]]){
    const before=s.hits();await db.controlled(()=>db.owner.query(`REVOKE EXECUTE ON FUNCTION ${schema}.append_audit(jsonb) FROM ${role}`))
    assert.equal((await send('/api/benchmark/search?q=audit')).status,503);assert.equal(s.hits(),before)
    await db.controlled(()=>db.owner.query(`GRANT EXECUTE ON FUNCTION ${schema}.append_audit(jsonb) TO ${role}`))
   }
  })
  await t.test('metadata role drift cannot escape to provider or the old market client',async()=>{
   const before=s.hits();await m.owner.query(`GRANT SELECT ON public.benchmark_metadata_values TO ${m.role}`)
   assert.equal((await send('/api/benchmark/metadata')).status,503);assert.equal(s.hits(),before)
   await m.owner.query(`REVOKE SELECT ON public.benchmark_metadata_values FROM ${m.role}`)
  })
  await t.test('a changed membership during the provider exchange withholds the private result',async()=>{
   s.setHook(()=>p.controlled(()=>p.owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1",[p.user])))
   let response;try{response=await send('/api/benchmark/search?q=inflight')}finally{await p.controlled(()=>p.owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE user_id=$1",[p.user]))}
   assert.equal(response.status,403)
  })
  await t.test('redirect and disconnect are terminal for that logical request without hidden retries',async()=>{
   for(const mode of['REDIRECT','DISCONNECT']){
    s.setMode(mode);const key='finder_'+randomUUID(),path='/api/benchmark/search?q='+mode,before=s.hits()
    assert.equal((await send(path,null,key)).status,503);assert.equal(s.hits(),before+1)
    s.setMode('NORMAL');assert.equal((await send(path,null,key)).status,503);assert.equal(s.hits(),before+1)
   }
  })
  await t.test('original AI clarification stays generic and a repeat cannot buy another response',async()=>{
   clarify=true;const key='finder_'+randomUUID(),path='/api/benchmark/ai-search',body={prompt:'ambiguous benchmark request'},before=s.hits()
   const response=await send(path,body,key);assert.equal(response.status,422);assert.deepEqual(await response.json(),{error:{code:'AI_NEEDS_CLARIFICATION',message:'Please clarify the benchmark description.'}})
   assert.equal(s.hits(),before+1);assert.equal((await send(path,body,key)).status,503);assert.equal(s.hits(),before+1)
  })
  await t.test('protected Source controls retain no raw query, prompt, returned body or credential',async()=>{
   const records=(await s.owner.query("SELECT jsonb_build_object('calls',(SELECT jsonb_agg(to_jsonb(c)) FROM profitia_external_call.calls c),'audit',(SELECT jsonb_agg(to_jsonb(e)) FROM profitia_ingestion.security_events e))::text AS text")).rows[0].text
   for(const privateValue of['Fixture steel index','ambiguous benchmark request',s.credentials.macrobondClientSecret,s.credentials.openAiKey,'fixture-returned-access'])assert.equal(records.includes(privateValue),false)
  })
 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  if(m)await m.close();if(s)await s.close();if(p)await p.close()
 }
})
