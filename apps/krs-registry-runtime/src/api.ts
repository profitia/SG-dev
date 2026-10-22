import http from 'node:http'
import {closed,demand,krs,nip,regon,parseJson} from '@profitia/krs-registry-contracts'
import {unavailableReadBoundary} from './e1.js'
import type {RegistryReadBoundary} from './e1.js'
import type {Catalog} from './catalog.js'
import {resolveIdentity} from './identity.js'
import {RegistryError} from './errors.js'
export function createApi(options:{catalog?:Catalog;boundary?:RegistryReadBoundary}={}){
  const boundary=options.boundary??unavailableReadBoundary
  return http.createServer({maxHeaderSize:16384,requestTimeout:10000,headersTimeout:10000},async(req,res)=>{
    const send=(status:number,value:unknown)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value))}
    try{
      const url=new URL(req.url??'/','http://localhost')
      if(req.method==='GET'&&url.pathname==='/health'&&!url.search)return send(200,{status:'ok'})
      // The supplied host parses/authenticates the actual request; browser identity fields are refused.
      if([...url.searchParams.keys()].some(k=>!['q','limit','cursor'].includes(k))||[...new Set(url.searchParams.keys())].some(k=>url.searchParams.getAll(k).length!==1))throw new RegistryError('INVALID_REQUEST')
      let result:unknown
      if(req.method==='GET'&&url.pathname==='/v1/companies/search'){
        const query=url.searchParams.get('q')??'',limit=Number(url.searchParams.get('limit')??20),cursor=url.searchParams.get('cursor')??undefined
        demand(query.trim().length>=1&&query.length<=200&&Number.isInteger(limit)&&limit>=1&&limit<=50,'INVALID_REQUEST')
        result=await boundary.execute({operation:'supplier.registry.search',request:req,selection:{query,limit:String(limit),...(cursor?{cursor}:{})}},async()=>{
          if(!options.catalog)throw new RegistryError('CATALOG_UNAVAILABLE');return options.catalog.search({query,limit,...(cursor?{cursor}:{})})
        })
      }else if(req.method==='GET'&&/^\/v1\/companies\/\d{10}$/.test(url.pathname)&&!url.search){
        const id=url.pathname.slice(-10);demand(krs(id),'INVALID_KRS')
        result=await boundary.execute({operation:'supplier.registry.read',request:req,selection:{krs:id}},async()=>{
          if(!options.catalog)throw new RegistryError('CATALOG_UNAVAILABLE');const snapshot=await options.catalog.read(id);return {status:snapshot?'SUCCESS':'NOT_IN_CATALOG',snapshot,coverage:await options.catalog.coverage()}
        })
      }else if(req.method==='POST'&&url.pathname==='/v1/identity/resolve'&&!url.search){
        if(req.headers['content-type']!=='application/json')throw new RegistryError('INVALID_REQUEST')
        const parts:Buffer[]=[];let size=0
        for await(const piece of req){size+=piece.length;if(size>4096)throw new RegistryError('REQUEST_TOO_LARGE');parts.push(piece)}
        const value=parseJson(Buffer.concat(parts).toString('utf8'),4096),input=closed(value,['selectedKrs','nip','regon'])
        demand((input.selectedKrs===null||krs(input.selectedKrs))&&(input.nip===null||nip(input.nip))&&(input.regon===null||regon(input.regon)),'INVALID_REQUEST')
        const selection=Object.fromEntries(Object.entries(input).filter(([,v])=>v!==null)) as Record<string,string>
        result=await boundary.execute({operation:'supplier.registry.resolve',request:req,selection},async()=>{
          if(!options.catalog)throw new RegistryError('CATALOG_UNAVAILABLE');return resolveIdentity(selection,options.catalog)
        })
      }else return send(404,{code:'NOT_FOUND'})
      send(200,result)
    }catch(e){const code=(e as {code?:string}).code
      if(code==='E1_REGISTRY_PRODUCER_UNAVAILABLE'||code==='CATALOG_UNAVAILABLE')send(503,{code})
      else if(code==='AUTHORIZATION_DENIED'||code==='AUDIT_UNAVAILABLE')send(403,{code:'ACCESS_DENIED'})
      else if(['INVALID_REQUEST','INVALID_KRS','INVALID_CONTRACT','OVERSIZED_JSON','DUPLICATE_JSON_KEY','REQUEST_TOO_LARGE','INVALID_SEARCH','INVALID_CURSOR','CATALOG_CHANGED_RESTART_SEARCH'].includes(code??''))send(400,{code})
      else send(503,{code:'REGISTRY_UNAVAILABLE'})
    }
  })
}
