import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const hash=v=>createHash('sha256').update(v).digest('hex'),root=path.resolve('../..')
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>{const p=path.join(directory,item.name);if(item.isSymbolicLink())throw Error('Artifact symlink refused');return item.isDirectory()?walk(p):[p]})
for(const [source,installed]of [['../../packages/krs-registry-contracts/dist/src','node_modules/@profitia/krs-registry-contracts/dist/src'],['../../packages/platform-contracts/src','node_modules/@profitia/platform-contracts/src'],['../../packages/platform-contracts/migrations','node_modules/@profitia/platform-contracts/migrations']])for(const file of walk(source)){
 const copy=path.join(installed,path.relative(source,file));if(!fs.existsSync(copy)||hash(fs.readFileSync(file))!==hash(fs.readFileSync(copy)))throw Error('Installed local contract drift; clean install-links required')
}
const files=new Map()
const add=(file,name)=>files.set(name,path.resolve(file))
for(const file of walk('dist').filter(f=>/\.(?:js|d\.ts)$/.test(f)))add(file,'runtime/'+file)
for(const file of ['package.json','package-lock.json',...walk('migrations')])add(file,'runtime/'+file)
const production=execFileSync('npm',['ls','--omit=dev','--all','--parseable','--install-links'],{encoding:'utf8'}).trim().split('\n').filter(p=>p.includes(path.sep+'node_modules'+path.sep))
for(const directory of production)for(const file of walk(directory).filter(f=>!f.includes(path.sep+'node_modules'+path.sep+'typescript'+path.sep)))add(file,'runtime/'+path.relative(process.cwd(),file))
const sourceFiles=['src','scripts','migrations'].flatMap(walk).concat(['package.json','package-lock.json','tsconfig.json']).sort()
const contractFiles=['../../packages/krs-registry-contracts/src'].flatMap(walk).concat(['../../packages/krs-registry-contracts/package.json','../../packages/krs-registry-contracts/package-lock.json']).sort()
const treeDigest=paths=>hash(JSON.stringify(paths.map(p=>[path.relative(root,path.resolve(p)).replaceAll(path.sep,'/'),hash(fs.readFileSync(p))])))
const manifest={artifactVersion:'1.0.0',sourceSha:git(['rev-parse','HEAD']),sourceDigest:treeDigest(sourceFiles),dependencyDigest:hash(fs.readFileSync('package-lock.json')),contractVersion:'profitia.krs-registry/1.0.0',identityVersion:'profitia.krs-company-identity/1.0.0',contractDigest:treeDigest(contractFiles),migrationDigest:treeDigest(walk('migrations')),nodeMajor:24,activation:'DEFERRED',externalEnabled:false,synchronizationEnabled:false,files:[...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,file])=>({name,sha256:hash(fs.readFileSync(file))}))}
fs.writeFileSync('dist/release-manifest.json',JSON.stringify(manifest,null,2)+'\n');add('dist/release-manifest.json','release-manifest.json')
fs.writeFileSync('dist/bundle-files.json',JSON.stringify([...files].sort(([a],[b])=>a.localeCompare(b))))
execFileSync('python3',['-c',`import json,zipfile
with zipfile.ZipFile('dist/krs-registry-runtime.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,file in json.load(open('dist/bundle-files.json')):
  info=zipfile.ZipInfo(name,(1980,1,1,0,0,0));info.external_attr=0o100644<<16;info.compress_type=zipfile.ZIP_DEFLATED
  z.writestr(info,open(file,'rb').read(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
`])
fs.writeFileSync('dist/artifact-proof.json',JSON.stringify({sourceSha:manifest.sourceSha,artifactSha256:hash(fs.readFileSync('dist/krs-registry-runtime.zip')),sourceDigest:manifest.sourceDigest,contractDigest:manifest.contractDigest,migrationDigest:manifest.migrationDigest,dependencyDigest:manifest.dependencyDigest},null,2)+'\n')
console.log('Reproducible standalone artifact and digests recorded')
