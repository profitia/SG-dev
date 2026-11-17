import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process'
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));assert.equal(pkg.dependencies['@clerk/backend'],'3.25.0');assert.equal(pkg.dependencies['@profitia/platform-contracts'],'file:../../packages/platform-contracts')
for(const dir of ['scripts','test'])for(const file of fs.readdirSync(dir)){if(!file.endsWith('.mjs'))continue;const r=spawnSync(process.execPath,['--check',path.join(dir,file)],{stdio:'inherit'});assert.equal(r.status,0)}
for(const file of fs.readdirSync('src')){if(!file.endsWith('.ts'))continue;const text=fs.readFileSync('src/'+file,'utf8');
// The owner-approved avatar hint is presentation only. Keep the authority ban
// everywhere else, including any future cookie write in this same file.
const presentationHintLines=["  const rememberedAvatar = () => { try { return document.cookie.match(/(?:^|;\\s*)sg_avatar_v1=(male|female)(?:;|$)/)?.[1] || null; } catch { return null; } };","  const rememberAvatar = value => { try { document.cookie = 'sg_avatar_v1='+value+'; Max-Age=31536000; Path=/; SameSite=Lax'+(window.location.protocol === 'https:' ? '; Secure' : ''); } catch {} };"];
let checked=file==='account-conversation.ts'?presentationHintLines.reduce((value,line)=>value.replace(line,''),text):text;
// FND-05 presentation only: fixed existing preference, comparison and literal enum.
// Each expression may occur once, in this approved renderer file only.
if(file==='account-visuals.ts')for(const expression of ["localStorage.getItem('srm:interface-theme:v1')==='dark'","localStorage.setItem('srm:interface-theme:v1',theme==='dark'?'dark':'light')"])checked=checked.replace(expression,'');
assert(!/localStorage|document\.cookie|jwt\.verify|jsonwebtoken|verifyToken\(/.test(checked),'No alternate browser/session/JWT authority')}
console.log('PASS: pinned SDK, syntax and prohibited session-authority checks; typecheck/tests provide behavioral acceptance')
