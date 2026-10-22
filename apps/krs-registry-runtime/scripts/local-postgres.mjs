import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {execFileSync,spawn} from 'node:child_process'
import {isolatedDatabaseUrl} from '../dist/config.js'
let directory,bin
const run=(command,args)=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']})
try{
 let connection=process.env.KRS_FIXTURE_OWNER_URL
 if(connection)isolatedDatabaseUrl(connection,'krs_test_owner')
 else{
  directory=fs.mkdtempSync(path.join(os.tmpdir(),'krs02-pg-'))
  bin=fs.existsSync('/opt/homebrew/opt/postgresql@16/bin/initdb')?'/opt/homebrew/opt/postgresql@16/bin':run('pg_config',['--bindir']).trim()
  const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r))
  run(path.join(bin,'initdb'),['-D',directory+'/data','-U','krs_test_owner','--auth=trust','--encoding=UTF8','--no-locale'])
  run(path.join(bin,'pg_ctl'),['-D',directory+'/data','-l',directory+'/server.log','-o',`-h 127.0.0.1 -p ${port} -k ${directory}`,'-w','start'])
  run(path.join(bin,'createdb'),['-h','127.0.0.1','-p',String(port),'-U','krs_test_owner','krs_registry_test'])
  connection=`postgresql://krs_test_owner@127.0.0.1:${port}/krs_registry_test`
 }
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--test','--test-timeout=60000','test/postgres.test.mjs'],{stdio:'inherit',env:{...process.env,KRS_FIXTURE_OWNER_URL:connection}});child.once('error',reject);child.once('exit',resolve)})
 process.exitCode=code??1
}finally{
 if(directory){try{run(path.join(bin,'pg_ctl'),['-D',directory+'/data','-m','immediate','-w','stop'])}finally{fs.rmSync(directory,{recursive:true,force:true})}}
}
