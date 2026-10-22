import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// Compile the accepted local DTO package into this consumer's install. No registry credentials,
// lifecycle installation, producer source changes or runtime activation are involved.
const app=fileURLToPath(new URL('../',import.meta.url)),root=path.resolve(app,'../..');
const source=path.join(root,'packages/krs-registry-contracts');
const installed=path.join(app,'node_modules/@profitia/krs-registry-contracts');
const targets=JSON.parse(fs.readFileSync(path.join(app,'deployment/krs-name-pilot-targets.json'),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(dir,entry.name);
  if(entry.isSymbolicLink())throw Error('KRS contract symlink refused');
  return entry.isDirectory()?walk(file):[file];
});
for(const dir of [source,installed]){
  if(fs.lstatSync(dir).isSymbolicLink()||fs.realpathSync(dir)!==dir)throw Error('An isolated install-links KRS dependency is required');
  const metadata=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
  if(metadata.name!=='@profitia/krs-registry-contracts'||metadata.version!==targets.acceptedContract.version)throw Error('KRS contract version drift');
}
const files=[...walk(path.join(source,'src')),path.join(source,'package.json'),path.join(source,'package-lock.json')].sort();
const digest=hash(JSON.stringify(files.map(file=>[path.relative(root,file).replaceAll(path.sep,'/'),hash(fs.readFileSync(file))])));
if(digest!==targets.acceptedContract.sourceDigest)throw Error('KRS contract source acceptance drift');
const out=path.join(installed,'dist');
if(fs.existsSync(out)&&fs.lstatSync(out).isSymbolicLink())throw Error('KRS contract output symlink refused');
execFileSync(process.execPath,[path.join(app,'node_modules/typescript/bin/tsc'),'-p',path.join(source,'tsconfig.json'),'--outDir',out],{stdio:'inherit',cwd:app});
console.log('Accepted KRS contract built for SRM: '+targets.acceptedContract.version);
