import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Fault} from './store.mjs';
export const PARSER_VERSION='pk-passive-inventory-v1';
export const EXTENSIONS=new Set(['.pdf','.doc','.docx','.ppt','.pptx','.txt','.md','.markdown']);
export async function extractDocument(bytes,fileName,{signal}={}){
 const extension=path.extname(fileName).toLowerCase();if(!EXTENSIONS.has(extension))throw new Fault(415,'UNSUPPORTED_FORMAT');
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>52428800)throw new Fault(413,'FILE_LIMIT');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'pk-job-'));await fs.chmod(directory,0o700);
 const input=path.join(directory,'source'+extension);
 try{
  await fs.writeFile(input,bytes,{mode:0o600});
  const output=await new Promise((resolve,reject)=>{
   const child=spawn('/opt/pk-venv/bin/python',['-B',new URL('./parser.py',import.meta.url).pathname,input,extension],{
    cwd:directory,env:{PATH:'/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['ignore','pipe','pipe'],detached:true});
   let size=0,parts=[],done=false;
   const stop=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
   const timer=setTimeout(()=>{stop();finish(new Fault(422,'EXTRACTION_TIMEOUT'));},120000);
   const abort=()=>{stop();finish(new Fault(409,'JOB_LEASE_LOST'));};signal?.addEventListener('abort',abort,{once:true});
   function finish(error,value){if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);}
   child.stdout.on('data',b=>{size+=b.length;if(size>16000000){stop();finish(new Fault(422,'EXTRACTED_TEXT_LIMIT'));}else parts.push(b);});
   child.stderr.resume();child.on('error',()=>finish(new Fault(503,'PARSER_UNAVAILABLE')));
   child.on('exit',code=>{let value;try{value=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return finish(new Fault(422,'EXTRACTION_FAILED'));}
    if(code!==0||value.error){const error=new Fault(422,/^[A-Z_]{3,64}$/.test(value.error??'')?value.error:'EXTRACTION_FAILED');
     error.parserStage=['INITIALIZE','ISOLATION','SOURCE_CHECK','EXTRACTION'].includes(value.failureStage)?value.failureStage:'UNKNOWN';
     error.exceptionType=['PermissionError','ImportError','ModuleNotFoundError','RuntimeError','ValueError','MemoryError','FileNotFoundError','TypeError','AttributeError','OSError'].includes(value.exceptionType)?value.exceptionType:'UNKNOWN';return finish(error);}
    if(value.parserVersion!==PARSER_VERSION||!Array.isArray(value.units)||!value.units.length||value.inventory?.nativeUnits!==value.units.length)return finish(new Fault(422,'SOURCE_INVENTORY_MISMATCH'));
    finish(null,value);
   });if(signal?.aborted)abort();
  });
  return output;
 }finally{await fs.rm(directory,{recursive:true,force:true});}
}
