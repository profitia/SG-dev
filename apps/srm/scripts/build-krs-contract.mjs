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

// The server adapter consumes the accepted native runtime as a local package.
// Compile a checked copy within the isolated install so TypeScript resolves the
// consumer's exact platform SDK and DTO versions rather than a sibling install.
const runtimeSource=path.join(root,'apps/krs-registry-runtime');
const runtimeInstalled=path.join(app,'node_modules/@profitia/krs-registry-runtime');
for(const dir of [runtimeSource,runtimeInstalled]){
  if(fs.lstatSync(dir).isSymbolicLink()||fs.realpathSync(dir)!==dir)throw Error('An isolated KRS runtime dependency is required');
  const metadata=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
  if(metadata.name!=='@profitia/krs-registry-runtime'||metadata.version!==targets.acceptedRuntime.version)throw Error('KRS runtime version drift');
}
const runtimeFiles=[...walk(path.join(runtimeSource,'src')),...['package.json','package-lock.json','tsconfig.json'].map(file=>path.join(runtimeSource,file))].sort();
const runtimeDigest=hash(JSON.stringify(runtimeFiles.map(file=>[path.relative(root,file).replaceAll(path.sep,'/'),hash(fs.readFileSync(file))])));
if(runtimeDigest!==targets.acceptedRuntime.sourceDigest)throw Error('KRS runtime source acceptance drift');
const buildSource=path.join(runtimeInstalled,'.build-src'),buildConfig=path.join(runtimeInstalled,'.build-tsconfig.json');
for(const file of [buildSource,buildConfig,path.join(runtimeInstalled,'dist')]){
  if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('KRS runtime build symlink refused');
}
try{
  fs.cpSync(path.join(runtimeSource,'src'),buildSource,{recursive:true});
  const config=JSON.parse(fs.readFileSync(path.join(runtimeSource,'tsconfig.json'),'utf8'));
  fs.writeFileSync(buildConfig,JSON.stringify({...config,compilerOptions:{...config.compilerOptions,rootDir:'.build-src',outDir:'dist'},include:['.build-src/**/*.ts']}));
  execFileSync(process.execPath,[path.join(app,'node_modules/typescript/bin/tsc'),'-p',buildConfig],{stdio:'inherit',cwd:app});
}finally{
  fs.rmSync(buildSource,{recursive:true,force:true});fs.rmSync(buildConfig,{force:true});
}
console.log('Accepted native KRS runtime built for SRM: '+targets.acceptedRuntime.version);
