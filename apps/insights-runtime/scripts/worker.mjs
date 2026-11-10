// The concrete SG Runtime host owns current E1, native read ports and Sentry.
// Invoke the supervised worker in that host; no arbitrary module path or IPC.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd=fileURLToPath(new URL("../../sg-runtime/",import.meta.url));
const child=spawn(process.execPath,["--import","tsx","scripts/insights-worker.ts"],{cwd,stdio:"inherit",env:process.env});
for(const signal of ["SIGTERM","SIGINT"]) process.once(signal,()=>child.kill(signal));
child.once("error",()=>{process.exitCode=1});
child.once("exit",code=>{process.exitCode=code??1});
