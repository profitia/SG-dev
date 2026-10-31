type MapStatus='ready'|'error'
type MapView=Readonly<{close():void}>
/** A sleeping runtime can fail its first iframe handshake. Retry one startup
 * with a new iframe/channel; every mount still uses the protected location read.
 * Closing or replacing the report fences all callbacks from the old attempt. */
export function mountSupplierMapWithStartupRetry(mount:(status:(value:MapStatus)=>void)=>MapView,onStatus:(value:MapStatus)=>void):MapView{
 let closed=false,ready=false,retried=false,generation=0,view:MapView|undefined
 const start=()=>{
  const current=++generation
  const status=(value:MapStatus)=>queueMicrotask(()=>{
   if(closed||current!==generation)return
   if(value==='ready'){ready=true;onStatus(value);return}
   if(!ready&&!retried){retried=true;view?.close();view=undefined;start()}
   else onStatus(value)
  })
  try{view=mount(status)}catch{status('error')}
 }
 start()
 return Object.freeze({close(){if(closed)return;closed=true;generation++;view?.close();view=undefined}})
}
