import type {NativeExternalTransport,NativeApiPathRule} from '../../src/external-call.mjs';
const protocol:NativeExternalTransport={schemaDigest:'a'.repeat(64),apiPathSchemaDigest:'b'.repeat(64),pathRules:[{method:'GET',prefix:'/calendar/',suffix:'',parameter:'API_PATH',requestFormat:'NONE'}],redirectOrigins:[],maximumResponseBytes:2097152,credentialMode:'SERVER_HEADERS',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'};
void protocol;
// @ts-expect-error API_PATH cannot admit a body-bearing request.
const post:NativeApiPathRule={method:'POST',prefix:'/calendar/',suffix:'',parameter:'API_PATH',requestFormat:'NONE'};
// @ts-expect-error The extension is GET/NONE only.
const json:NativeApiPathRule={method:'GET',prefix:'/calendar/',suffix:'',parameter:'API_PATH',requestFormat:'JSON'};
void post;void json;
