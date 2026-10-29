import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import pg from 'pg'
import {readyReportReleasePlan,executeReadyReportRelease} from './ready-report-release.mjs'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const target=JSON.parse(read('deployment/xray-fresh-performance-2026-10-29.json'))
const md5=v=>createHash('md5').update(v).digest('hex')
const sha=v=>createHash('sha256').update(v).digest('hex')
const fail=()=>{throw Error('Exact main Development FRESH release evidence required')}
const names=Object.keys(target.functions)
export async function captureFreshFunctions(client){
 const rows=(await client.query(`SELECT oid::regprocedure::text id,pg_get_functiondef(oid) definition,
   md5(pg_get_functiondef(oid)) digest,pg_get_userbyid(proowner) owner,proacl::text acl,prosecdef,proconfig
   FROM pg_proc WHERE oid=ANY($1::regprocedure[]) ORDER BY 1`,[names])).rows
 if(rows.length!==names.length||rows.some(r=>!target.functions[r.id]||r.owner!=='profitia_access_owner'||!r.prosecdef||md5(r.definition)!==r.digest))fail()
 return rows
}
export function freshReportReleasePlan({mode,sourceSha,previousSha,backup}){
 if(!['install-bind','rollback'].includes(mode)||target.targetEnvironment!=='development'
  ||target.serviceId!=='srv-db1vu6gm7kps73d0e3r0'||target.databaseName!=='platform_private'
  ||!Array.isArray(backup)||backup.length!==names.length||new Set(backup.map(r=>r.id)).size!==names.length)fail()
 for(const row of backup)if(!target.functions[row.id]||row.owner!=='profitia_access_owner'||!row.prosecdef
  ||md5(row.definition)!==row.digest||row.digest!==target.functions[row.id].before)fail()
 const base=readyReportReleasePlan({mode:mode==='install-bind'?'bind':'rollback-bind',sourceSha,previousSha})
 if(['serviceId','projectId','branchId','databaseName'].some(k=>target[k]!==base.target[k]))fail()
 const statements=[...base.statements],at=statements.findIndex(s=>s.text.startsWith('UPDATE profitia_services.'))
 if(at<0)fail()
 const expected=mode==='install-bind'?'before':'after',result=mode==='install-bind'?'after':'before'
 const check=key=>({text:`DO $fresh$ BEGIN IF NOT (${names.map(n=>`EXISTS(SELECT 1 FROM pg_proc WHERE oid='${n}'::regprocedure AND proowner='profitia_access_owner'::regrole AND prosecdef AND md5(pg_get_functiondef(oid))='${target.functions[n][key]}')`).join(' AND ')}) THEN RAISE EXCEPTION 'FRESH function source drift';END IF;END $fresh$`,values:[]})
 const acl={text:`DO $fresh_acl$ BEGIN IF (${names.map(n=>{const r=backup.find(r=>r.id===n);return `(SELECT proacl::text FROM pg_proc WHERE oid='${n}'::regprocedure) IS DISTINCT FROM ${r.acl===null?'NULL':"'"+r.acl.replaceAll("'","''")+"'"}`}).join(' OR ')}) THEN RAISE EXCEPTION 'FRESH ACL drift';END IF;END $fresh_acl$`,values:[]}
 const freshStatements=[check(expected),acl,
  ...(mode==='install-bind'?[{text:read('db/private-store/'+target.migration),values:[]}]:backup.map(r=>({text:r.definition,values:[]}))),check(result),acl]
 statements.splice(at,0,...freshStatements)
 return Object.freeze({...base,mode:base.mode,freshMode:mode,statements,freshStatements})
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1]
 if(args.some((x,i)=>!['--mode','--sha','--previous-sha','--backup','--apply'].includes(x)&&!['--mode','--sha','--previous-sha','--backup'].includes(args[i-1])))fail()
 const url=new URL(process.env.SRM_READY_RELEASE_DIRECT_URL??'')
 if(process.env.TARGET_ENVIRONMENT!=='development'||url.hostname!=='ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech'
  ||url.username!=='neondb_owner'||url.pathname!=='/platform_private'||url.searchParams.get('sslmode')!=='require')fail()
 const client=new pg.Client({connectionString:url.toString()});await client.connect()
 try{
  const path=value('--backup');if(!path)fail()
  const backup=value('--mode')==='rollback'?JSON.parse(fs.readFileSync(path,'utf8')):await captureFreshFunctions(client)
  if(value('--mode')!=='rollback')fs.writeFileSync(path,JSON.stringify(backup,null,2)+'\n',{flag:'wx',mode:0o600})
  const plan=freshReportReleasePlan({mode:value('--mode'),sourceSha:value('--sha'),previousSha:value('--previous-sha'),backup})
  console.log(JSON.stringify({...await executeReadyReportRelease(client,plan,{apply:args.includes('--apply')}),freshMode:plan.freshMode,
   functionBackupSha256:sha(fs.readFileSync(path)),functionCount:backup.length,existingPoliciesPreserved:true}))
 }finally{await client.end()}
}
