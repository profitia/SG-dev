// Host module is deployed, server-owned code (not IPC or an operator workspace).
// It constructs ordinary scoped pools and the installed E1/Source adapters.
import {pathToFileURL} from 'node:url';
const configured=process.env.INSIGHTS_HOST_MODULE;
if(!configured||!configured.startsWith('/'))throw Error('APPROVED_HOST_MODULE_REQUIRED');
const {createRuntime}=await import(pathToFileURL(configured));const runtime=await createRuntime();
const controller=new AbortController();for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>controller.abort());
await runtime.serveWorker({signal:controller.signal});
