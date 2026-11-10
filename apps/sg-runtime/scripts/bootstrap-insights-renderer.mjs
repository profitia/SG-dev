import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
if(process.env.INSIGHTS_REPORTS_ENABLED==='true'){
 const root=fileURLToPath(new URL('../../insights-runtime/',import.meta.url))
 const python=fileURLToPath(new URL('../.insights-python/bin/python',import.meta.url))
 const venv=fileURLToPath(new URL('../.insights-python',import.meta.url))
 function run(bin,args){const r=spawnSync(bin,args,{cwd:root,stdio:'inherit',env:process.env});if(r.status!==0)throw Error('INSIGHTS_BUILD_DEPENDENCY_FAILED')}
 run('npm',['ci','--install-links','--ignore-scripts','--no-audit','--no-fund'])
 if(!existsSync(python))run('python3',['-m','venv',venv])
 run(python,['-m','pip','install','--disable-pip-version-check','-r','render/requirements.txt'])
 run(python,['-c','import reportlab,pypdf; assert reportlab.Version=="4.4.9"; assert pypdf.__version__=="6.10.0"'])
}
