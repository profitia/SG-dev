export {NEWS_DISCOVERY_CONTRACT_VERSION} from '../platform-source-hub-contracts/index.mjs';
import {parseHubRequest,closed,SourceHubError} from '../platform-source-hub-contracts/index.mjs';
export const NEWSFEED_API_CONTRACT_VERSION='1.0.0';
const kinds=['company','product','investment','category','topic'];
const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f]/.test(value))throw new SourceHubError('INVALID_OBSERVATION');return value.trim();};
export function parseObservation(value,{partial=false}={}){
 if(!closed(value,partial?['version','name','subjectKind','subject','request','status']:['name','subjectKind','subject','request']))throw new SourceHubError('INVALID_OBSERVATION');
 const out={};
 for(const [key,max]of [['name',200],['subject',1000]])if(!partial||value[key]!==undefined)out[key]=text(value[key],max);
 if(!partial||value.subjectKind!==undefined){if(!kinds.includes(value.subjectKind))throw new SourceHubError('INVALID_OBSERVATION');out.subjectKind=value.subjectKind;}
 if(!partial||value.request!==undefined){out.request=parseHubRequest(value.request);if(out.request.family!=='news-discovery'||out.request.operation!=='search')throw new SourceHubError('NEWS_DISCOVERY_REQUIRED');}
 if(partial){if(!Number.isSafeInteger(value.version)||value.version<1)throw new SourceHubError('OBSERVATION_VERSION_REQUIRED');out.version=value.version;if(value.status!==undefined){if(!['ACTIVE','PAUSED'].includes(value.status))throw new SourceHubError('INVALID_OBSERVATION');out.status=value.status;}if(Object.keys(out).length===1)throw new SourceHubError('EMPTY_UPDATE');}
 return out;
}
