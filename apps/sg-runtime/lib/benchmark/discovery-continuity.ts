import {PrismaClient} from '@prisma/client'
import targets from '@/deployment/benchmark-discovery-targets.json'
import {readDiscoveryConfiguration} from './discovery-runtime'

let started:Promise<void>|undefined
/** Uses only the enrolled Source role. The owner policy can revoke renewal;
 * missing, expired or drifted authority is never recreated by this process. */
export function startFinderSourceContinuity():Promise<void>{
 return started??=(async()=>{
  const config=readDiscoveryConfiguration();if(!config)return
  const url=new URL(config.sourceUrl)
  for(const[k,v]of Object.entries({schema:'profitia_ingestion',connection_limit:'1',sslaccept:'strict',pool_timeout:'3',connect_timeout:'10'}))url.searchParams.set(k,v)
  const prisma=new PrismaClient({datasources:{db:{url:url.toString()}},log:[]})
  const check=async()=>prisma.$transaction(async tx=>{
   await tx.$executeRawUnsafe("SET LOCAL statement_timeout='4000ms'")
   await tx.$executeRawUnsafe("SET LOCAL lock_timeout='200ms'")
   const rows=await tx.$queryRawUnsafe<{result:{status:string;leaseUntil?:string}}[]>('SELECT profitia_ingestion.maintain_source_technical_access($1) AS result',targets.source.continuitySqlDigest)
   const result=rows.length===1?rows[0].result:null
   if(!result||!['CURRENT','RENEWED','DEFERRED_ACTIVE_SOURCE_CALL'].includes(result.status))throw Error('Finder Source continuity unavailable')
   if(result.status==='RENEWED')console.info(JSON.stringify({event:'FINDER_SOURCE_TECHNICAL_LEASE',status:result.status,leaseUntil:result.leaseUntil}))
   return result.status
  },{timeout:7000,maxWait:3000})
  const schedule=(delay:number)=>{const timer=setTimeout(async()=>{
   let next=3600000
   try{if(await check()==='DEFERRED_ACTIVE_SOURCE_CALL')next=60000}catch{next=60000;console.error(JSON.stringify({event:'FINDER_SOURCE_TECHNICAL_LEASE',status:'BLOCKED'}))}
   schedule(next)
  },delay);timer.unref()}
  try{const status=await check();schedule(status==='DEFERRED_ACTIVE_SOURCE_CALL'?60000:3600000)}catch{console.error(JSON.stringify({event:'FINDER_SOURCE_TECHNICAL_LEASE',status:'BLOCKED'}));schedule(60000)}
 })()
}
