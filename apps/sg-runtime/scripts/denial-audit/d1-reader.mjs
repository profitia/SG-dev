import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import path from 'node:path'

const receipt=JSON.parse(await fs.readFile(new URL('./adoption.json',import.meta.url),'utf8'))
const deny=()=>{throw new Error('SG2_D1_UNAVAILABLE')}
const hash=b=>createHash('sha256').update(b).digest('hex')
const caseIds=new Set(['H1','H2','H3','H4','C1'])

function queryAdapter(client,store) {
 const expected=`SELECT profitia_sg2_d1_${store}.read_case($1::text) AS result`
 const role=`sg2_d1_${store}_denial_reader`,database=store==='private'?'platform_private':'neondb'
 return async(text,values)=>{
  if(text!==expected||!Array.isArray(values)||values.length!==1||!caseIds.has(values[0]))deny()
  let opened=false
  try{
   await client.query('BEGIN READ ONLY');opened=true
   await client.query("SET LOCAL statement_timeout='5s';SET LOCAL lock_timeout='1s'")
   const identity=await client.query('SELECT current_user AS role,session_user AS login,current_database() AS database')
   const v=identity.rows?.[0]
   if(identity.rows?.length!==1||v?.role!==role||v?.login!==role||v?.database!==database)deny()
   const result=await client.query({text,values,query_timeout:7000})
   await client.query('COMMIT');opened=false
   return result
  }catch{
   if(opened)try{await client.query('ROLLBACK')}catch{}
   deny()
  }
 }
}

/** Not imported by any SG2 route or runtime. Requires separately approved operator clients/audit adapter. */
export async function prepareD1Consumer(config) {
 if(!config||Object.keys(config).sort().join(',')!=='audit,environment,now,privateClient,producerCheckout,sourceClient'
  ||config.environment!=='development'||typeof config.now!=='function'||typeof config.privateClient?.query!=='function'
  ||typeof config.sourceClient?.query!=='function'||!config.audit)deny()
 let bytes
 try{
  const root=await fs.realpath(config.producerCheckout)
  if(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()!==receipt.producerSourceSha)deny()
  for(const [file,expected]of Object.entries(receipt.sourceSha256)){
   const target=path.join(root,file),stat=await fs.lstat(target)
   if(!stat.isFile()||stat.isSymbolicLink())deny()
   const actual=await fs.readFile(target)
   const canonical=execFileSync('git',['show',receipt.producerSourceSha+':'+file],{cwd:root,stdio:['ignore','pipe','ignore']})
   if(hash(actual)!==expected||hash(canonical)!==expected)deny()
   if(file===receipt.modulePath)bytes=canonical
  }
  if(!bytes)deny()
  // Execute the already verified immutable git bytes, without a filesystem race.
  const producer=await import('data:text/javascript;base64,'+bytes.toString('base64'))
  if(producer.CONTRACT_ID!==receipt.contractId)deny()
  return producer.createFiveCaseReader({environment:'development',privateQuery:queryAdapter(config.privateClient,'private'),sourceQuery:queryAdapter(config.sourceClient,'source'),audit:config.audit,now:config.now})
 }catch{deny()}
}
