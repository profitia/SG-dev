import type {PrismaClient} from '@/generated/market-data-client'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
export type DiscoveryMetadataBinding=Readonly<{projectId:string;branchId:string;databaseName:string;role:string;schemaDigest:string}>
const refuse=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}

/** Real generated ORM, separate ordinary pool pointed at approved views with
 * the original table names. No hand-written replacement query interpreter. */
export function createDiscoveryMetadataLoader(prisma:PrismaClient,input:DiscoveryMetadataBinding){
 const binding=Object.freeze({...input})
 if(typeof window!=='undefined'||!prisma||!/^[a-f0-9]{64}$/.test(binding.schemaDigest)
  ||!['projectId','branchId','databaseName','role'].every(k=>/^[A-Za-z0-9_-]{1,128}$/.test(binding[k as keyof DiscoveryMetadataBinding]))
  ||binding.role==='profitia_market_read_owner')throw TypeError('Explicit ordinary metadata binding required')
 return async()=>{
  await prisma.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
   await tx.$executeRawUnsafe("SET LOCAL statement_timeout='4000ms'")
   await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2000ms'")
   const rows=await tx.$queryRawUnsafe<Array<Record<string,unknown>>>(`SELECT current_user::text AS role,session_user::text AS login,current_database() AS database_name,
    r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolcanlogin,r.rolconnlimit,
    EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS role_membership,
    has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
    has_schema_privilege(current_user,'public','CREATE') AS public_create,
    has_schema_privilege(current_user,'profitia_metadata_read','CREATE') AS metadata_create,
    (SELECT count(*)::int FROM pg_roles o WHERE o.rolname='profitia_market_read_owner'
     AND NOT(o.rolcanlogin OR o.rolinherit OR o.rolsuper OR o.rolbypassrls OR o.rolcreatedb OR o.rolcreaterole OR o.rolreplication)
     AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=o.oid)) AS controlled_owner,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_metadata_read'
     AND n.nspowner='profitia_market_read_owner'::regrole AND c.relowner='profitia_market_read_owner'::regrole
     AND(c.relname='installation' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
      OR c.relname IN('benchmark_metadata_facets','benchmark_metadata_values') AND c.relkind='v' AND 'security_barrier=true'=ANY(c.reloptions))) AS controlled_objects,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
     AND c.relkind IN('r','p','v','m','f')
     AND(has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
     AND(n.nspname<>'profitia_metadata_read' OR c.relname NOT IN('installation','benchmark_metadata_facets','benchmark_metadata_values'))) AS outside_access,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_metadata_read'
     AND(has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,SELECT WITH GRANT OPTION')
      OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES,SELECT WITH GRANT OPTION'))) AS write_access,
    EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef
     AND n.nspname NOT IN('pg_catalog','information_schema') AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS definer_access
    FROM pg_roles r WHERE r.rolname=current_user`)
   const d=rows[0]
   if(rows.length!==1||!d||d.role!==binding.role||d.login!==binding.role||d.database_name!==binding.databaseName
    ||d.rolcanlogin!==true||d.rolconnlimit!==1||d.controlled_owner!==1||d.controlled_objects!==3
    ||['rolsuper','rolbypassrls','rolinherit','rolcreatedb','rolcreaterole','rolreplication','role_membership','database_create','public_create','metadata_create','outside_access','write_access','definer_access'].some(k=>d[k]!==false))return refuse()
   const receipts=await tx.$queryRawUnsafe<Array<Record<string,unknown>>>('SELECT schema_version,schema_digest,project_id,branch_id,database_name,runtime_role::text,expires_at FROM profitia_metadata_read.installation WHERE singleton')
   const i=receipts[0]
   if(receipts.length!==1||!i||i.schema_version!=='1.0.0'||i.schema_digest!==binding.schemaDigest||i.project_id!==binding.projectId
    ||i.branch_id!==binding.branchId||i.database_name!==binding.databaseName||i.runtime_role!==binding.role||!(new Date(String(i.expires_at)).getTime()>Date.now()))return refuse()
  },{timeout:8000,maxWait:3000})
  return prisma
 }
}
