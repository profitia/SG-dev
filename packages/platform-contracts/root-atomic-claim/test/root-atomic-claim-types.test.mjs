import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
test('opaque exact handoff types compile and reject HTTP/JSON authority and alternate authorization',()=>{
 const ts=createRequire(new URL('../../../../apps/architecture-lab/package.json',import.meta.url))('typescript')
 const program=ts.createProgram([fileURLToPath(new URL('./root-atomic-claim-types.mts',import.meta.url))],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']})
 const errors=ts.getPreEmitDiagnostics(program)
 assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}))
})
