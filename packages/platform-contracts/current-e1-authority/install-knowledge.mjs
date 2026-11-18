import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
// Two-side installer port, invoked by the established separately held owners.
// Exact source digest and native binding first. NEVER grants an account or
// enrolls a receiver; a reviewed owner packet performs those explicit actions.
export async function installKnowledgeSchema({side,query,approvedSha256}){
 if(!['authority','receiver'].includes(side)||typeof query!=='function')throw TypeError('Exact installer side required');
 const file=new URL(side==='authority'?'./migrations/015-knowledge-authority.sql':'./migrations/016-knowledge-receiver.sql',import.meta.url);
 const sql=await readFile(file,'utf8'),sha256=createHash('sha256').update(sql).digest('hex');
 if(approvedSha256!==sha256)throw Error('EXACT_SCHEMA_REVIEW_REQUIRED');
 const {rows}=await query('SELECT current_user AS role,current_database() AS database_name');
 if(rows.length!==1||rows[0].role!==(side==='authority'?'profitia_access_owner':'platform_knowledge_owner')
  ||side==='receiver'&&rows[0].database_name!=='platform_knowledge')throw Error('INSTALLATION_BINDING_REJECTED');
 await query(sql);return{status:'INSTALLED',side,sha256};
}
