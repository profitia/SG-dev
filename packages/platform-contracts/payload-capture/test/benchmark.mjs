import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import assert from 'node:assert/strict'
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {captureFinitePayload} from '../src/payload-capture.mjs'

const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1]
if(!args.includes('--input')||!args.includes('--output'))throw Error('Explicit local input and aggregate output required')
const bytes=fs.readFileSync(option('--input')),input=JSON.parse(bytes)
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
const baseline=()=>{
 const text=JSON.stringify(input,(_key,v)=>{if(typeof v==='number'&&!Number.isFinite(v))throw TypeError('non-finite');return v})
 if(Buffer.byteLength(text)>32*1024*1024)throw RangeError('bound')
 const value=JSON.parse(text),digest=operationPayloadDigest(value);return{value:freeze(value),digest,byteLength:Buffer.byteLength(text)}
}
const candidate=()=>captureFinitePayload(input)
const check=(a,b)=>{assert.equal(a.digest,b.digest);assert.equal(a.byteLength,b.byteLength)}
check(baseline(),candidate());check(baseline(),candidate())
const samples={baseline:[],candidate:[]}
let captured
for(let i=0;i<11;i++)for(const name of i%2?['candidate','baseline']:['baseline','candidate']){
 const started=performance.now(),result=name==='baseline'?baseline():candidate();samples[name].push(performance.now()-started)
 if(name==='candidate')captured=result
}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
const repeatStart=performance.now();for(let i=0;i<1000;i++)assert.equal(captureFinitePayload(captured.value),captured)
const result={schemaVersion:'1.0',kind:'LOCAL_CPU_ONLY_SANITIZED_RETAINED_GRAPH',notOriginalProviderResponse:true,notFullNormalizedMgbiFinancialResult:true,liveFreshMeasured:false,inputFileBytes:bytes.length,inputSha256:createHash('sha256').update(bytes).digest('hex'),normalizedBytes:captured.byteLength,digestMatchesUnchangedSdk:true,digest:captured.digest,nodeCount:captured.nodeCount,depth:captured.depth,samplesMs:samples,medianMs:{baseline:median(samples.baseline),candidate:median(samples.candidate)},reuse1000Ms:performance.now()-repeatStart}
fs.writeFileSync(option('--output'),JSON.stringify(result,null,2)+'\n')
process.stdout.write(JSON.stringify({inputFileBytes:result.inputFileBytes,normalizedBytes:result.normalizedBytes,medianMs:result.medianMs,digestMatchesUnchangedSdk:true,liveFreshMeasured:false})+'\n')
