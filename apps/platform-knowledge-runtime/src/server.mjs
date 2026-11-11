import http from 'node:http';
export function createServer({database,telemetry}){
 let pending=null,last=null,validUntil=0;
 const probe=()=>{
   if(last!==null && Date.now()<validUntil)return Promise.resolve(last);
   if(pending)return pending;
   pending=(async()=>{await Promise.resolve();try{await database.probe();telemetry.emit('FOUNDATION_PROBE_OK');last=true;validUntil=Date.now()+30000;return true;}
     catch{telemetry.emit('FOUNDATION_PROBE_FAILED');last=false;validUntil=Date.now()+5000;return false;}
     finally{pending=null;}})();return pending;
 };
 return http.createServer({maxHeaderSize:8192,requestTimeout:15000,headersTimeout:10000},async(req,res)=>{
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
   const reply=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
   if(req.method==='GET'&&req.url==='/health/live')return reply(200,{status:'LIVE',phase:'FOUNDATION_ONLY',processingEnabled:false});
   if(req.method==='GET'&&req.url==='/health/ready')return reply(503,{status:'NOT_READY_FOR_PROCESSING',phase:'FOUNDATION_ONLY'});
   if(req.method==='GET'&&req.url==='/health/foundation'){
     if(await probe())return reply(200,{status:'FOUNDATION_DATABASE_VERIFIED',phase:'FOUNDATION_ONLY',processingEnabled:false});
     return reply(503,{status:'FOUNDATION_UNAVAILABLE'});
   }
   // No upload, private data or business operation is exposed before adoption.
   return reply(req.url?.startsWith('/v1/')?503:404,{status:req.url?.startsWith('/v1/')?'CAPABILITY_NOT_ACTIVATED':'NOT_FOUND'});
 });
}
