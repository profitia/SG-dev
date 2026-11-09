import {fileURLToPath} from 'node:url';
import {readdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';
for(const dir of ['src','scripts','tests'])for(const name of readdirSync(new URL('../'+dir+'/',import.meta.url)))if(name.endsWith('.mjs')){const r=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../'+dir+'/'+name,import.meta.url))],{stdio:'inherit'});if(r.status)process.exit(r.status)}
