import {loadConfig} from './config.js'
import {createApi} from './api.js'
const config=loadConfig(),server=createApi()
server.listen(config.port,'0.0.0.0')
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{server.close();setTimeout(()=>process.exit(1),10000).unref()})
