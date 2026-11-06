// Controlled preparation CLI. Live research/model commands require separately
// installed, hash-bound adapters and owner decisions; no raw HTTP escape hatch.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {reportWindows,projectForecast,hash,V04_PROFILE} from '../lib/insights/oil-asphalt-v04-contract.mjs';
import {prepareResearchPlan} from '../lib/insights/oil-asphalt-v04-research.mjs';
const {values}=parseArgs({options:{action:{type:'string'},asof:{type:'string'},window:{type:'string'},d0:{type:'string'},lastcase:{type:'string'},output:{type:'string'}}});
function write(name,value){fs.mkdirSync(values.output,{recursive:true,mode:0o700});const p=values.output+'/'+name;if(fs.existsSync(p))throw Error('IMMUTABLE_OUTPUT_EXISTS');fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
if(!values.output)throw Error('OUTPUT_DIRECTORY_REQUIRED');
if(values.action==='prepare-research'){
 const windows=reportWindows(values.asof??new Date().toISOString(),'Europe/Warsaw',values.window??'TUESDAY_MONDAY');
 write('RESEARCH_PLAN_PROPOSED.json',prepareResearchPlan(windows));write('PILOT_PROFILE_PROPOSED.json',V04_PROFILE);
 console.log(JSON.stringify({status:'PREPARED_NOT_ADMITTED',upstreamCalls:0,generativeCalls:0,window:windows.mode}));
}else if(values.action==='project-frozen-forecast'){
 const bytes=fs.readFileSync(values.d0),d0=JSON.parse(bytes);const last=values.lastcase?JSON.parse(fs.readFileSync(values.lastcase,'utf8')):null;
 write('FORECAST_PROJECTION.json',projectForecast(d0,hash(bytes),last));console.log(JSON.stringify({status:'FROZEN_FORECAST_PROJECTED',newForecastFits:0,providerCalls:0}));
}else throw Error('LIVE_ACTION_NOT_INSTALLED_OR_NOT_ADMITTED');
