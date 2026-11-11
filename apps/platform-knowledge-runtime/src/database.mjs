import pg from 'pg';
export function createDatabase(config){
 const pool=new pg.Pool({connectionString:config.databaseUrl,max:2,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,statement_timeout:5000,query_timeout:6000});
 // Never forward raw SQL/client errors, connection strings or server notices.
 pool.on('error',()=>{});
 return {pool,async engineReady(){const r=await pool.query('SELECT version FROM platform_knowledge.schema_version');return r.rows.some(x=>x.version===1);},async probe(){
   const {rows}=await pool.query(`SELECT current_database() AS database_name,current_user AS role_name,
     r.rolsuper,r.rolinherit,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
     has_schema_privilege(current_user,'platform_knowledge','USAGE') AS schema_usage,
     has_schema_privilege(current_user,'platform_knowledge','CREATE') AS schema_create,
     pg_has_role(current_user,'platform_knowledge_owner','MEMBER') AS owner_member,
     EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS vector_installed
     FROM pg_roles r WHERE r.rolname=current_user`);
   const r=rows[0];
   if(!r||r.database_name!=='platform_knowledge'||r.role_name!==config.expectedRole||r.rolsuper||r.rolcreatedb
     ||r.rolinherit||r.rolcreaterole||r.rolreplication||r.rolbypassrls||!r.schema_usage||r.schema_create||r.owner_member||!r.vector_installed)throw new Error('DATABASE_IDENTITY_REJECTED');
   return {status:'VERIFIED_LIMITED_ROLE'};
 },close:()=>pool.end()};
}
