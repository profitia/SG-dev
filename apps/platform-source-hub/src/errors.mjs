import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
import {DiscoveryError} from './providers/newsapi.mjs';
export function safeError(error){
 if(error instanceof SourceHubError)return {status:error.status,code:error.code,retryAfterSeconds:error.retryAfterSeconds};
 if(error instanceof DiscoveryError)return {status:['TIMEOUT'].includes(error.code)?504:['RATE_LIMITED','QUOTA_EXHAUSTED'].includes(error.code)?429:['UNSUPPORTED_CRITERIA','UNKNOWN_CRITERIA','INVALID_CRITERIA','INCOMPATIBLE_CRITERIA'].includes(error.code)?400:502,code:error.code,retryAfterSeconds:error.retryAfterSeconds};
 if(error?.name==='OperationDenied')return {status:403,code:'OPERATION_DENIED'};
 return {status:503,code:'SERVICE_UNAVAILABLE'};
}
