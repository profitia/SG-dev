import schemas from './schemas.json' with {type: 'json'};
export const CONTRACT = Object.freeze({id:'profitia.platform-knowledge', version:'0.2.0'});
export {schemas};
const fail = code => {throw new TypeError(code);};
const text = v => typeof v === 'string' && v.trim().length > 0;

// This transport carries no identity assertion. The receiver obtains identity
// and operation admission from its trusted server/E1 adapter, separately.
export function assertQuery(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) fail('INVALID_QUERY');
  const fields = schemas.$defs.Query.properties;
  if (Object.keys(q).some(k => !Object.hasOwn(fields,k))
    || schemas.$defs.Query.required.some(k => !Object.hasOwn(q,k))) fail('INVALID_QUERY_FIELDS');
  if (!['0.1.0',CONTRACT.version].includes(q.version) || !text(q.requestId) || q.requestId.length>200
    || !fields.task.enum.includes(q.task) || !text(q.query) || q.query.length>12000
    || !text(q.language) || q.language.length>32 || !text(q.tokenizerId) || q.tokenizerId.length>200
    || !text(q.targetModel) || q.targetModel.length>200
    || !Number.isSafeInteger(q.maxTokens) || q.maxTokens<1 || q.maxTokens>16000
    || !Array.isArray(q.scopes) || q.scopes.length<1 || q.scopes.length>2
    || new Set(q.scopes).size!==q.scopes.length
    || q.scopes.some(s => !['PROFITIA_SHARED','ACCOUNT_PRIVATE'].includes(s))) fail('INVALID_QUERY');
  if (q.documentIds!==undefined && (!Array.isArray(q.documentIds) || q.documentIds.length>50
    || new Set(q.documentIds).size!==q.documentIds.length
    || q.documentIds.some(id=>!text(id)||id.length>200))) fail('INVALID_DOCUMENT_IDS');
  if(q.filters!==undefined&&(q.version!=='0.2.0'||!q.filters||Object.getPrototypeOf(q.filters)!==Object.prototype
   ||Object.entries(q.filters).some(([k,v])=>!['domain','materialType','language','authority'].includes(k)||!text(v)||v.length>200)))fail('INVALID_METADATA_FILTERS');
  if (q.task==='DOCUMENT_SUMMARY' && q.documentIds?.length!==1) fail('SUMMARY_REQUIRES_ONE_DOCUMENT');
  if (q.task==='MEMORY_RECALL' && (q.scopes.length!==1 || q.scopes[0]!=='ACCOUNT_PRIVATE')) fail('MEMORY_IS_PRIVATE');
  return q;
}

// Cross-field assertions complement the published JSON schemas. The server
// must also validate the full schema and apply current access/rights filters.
export function assertContextSemantics(q, result, countTokens) {
  assertQuery(q);
  if(typeof countTokens!=='function') fail('TOKENIZER_REQUIRED');
  if(!result || result.version!==q.version || result.requestId!==q.requestId
    || result.tokenizerId!==q.tokenizerId || result.targetModel!==q.targetModel
    || !schemas.$defs.Context.properties.status.enum.includes(result.status)
    || !Array.isArray(result.evidence) || !Array.isArray(result.omissions)) fail('INVALID_CONTEXT');
  const tokens=countTokens(JSON.stringify(result));
  if(!Number.isSafeInteger(tokens)||tokens<0||result.usedTokens!==tokens||tokens>q.maxTokens) fail('CONTEXT_BUDGET_EXCEEDED');
  if(['EMPTY','INSUFFICIENT_EVIDENCE','DENIED','UNAVAILABLE','STALE'].includes(result.status)
    && result.evidence.length) fail('NON_USABLE_CONTEXT_HAS_EVIDENCE');
  if(result.status==='READY' && (!result.evidence.length || result.omissions.length
    || result.evidence.some(e=>e.coverage!=='COMPLETE'))) fail('READY_REQUIRES_COMPLETE_EVIDENCE');
  if(q.task==='DOCUMENT_SUMMARY' && result.status==='READY'
    && result.evidence.some(e=>e.documentId!==q.documentIds[0])) fail('SUMMARY_SCOPE_MISMATCH');
  for(const e of result.evidence){
    if(!q.scopes.includes(e.scope)||e.authority==='WITHDRAWN') fail('EVIDENCE_OUTSIDE_SCOPE');
    if(!Array.isArray(e.locations)||!e.locations.length
      ||e.locations.some(l=>!Number.isSafeInteger(l.start)||!Number.isSafeInteger(l.end)||l.start<0||l.end<=l.start)) fail('CITATION_LOCATION_REQUIRED');
    if(!e.rights || e.rights.apiExcerptAllowed!==true) fail('EXCERPT_NOT_ALLOWED');
  }
  if(result.summary){
    const s=result.summary;
    if(q.version!=='0.2.0'||q.task!=='DOCUMENT_SUMMARY'||s.generated!==true||typeof s.text!=='string'
      ||!Array.isArray(s.coveredUnitIds)||!Array.isArray(s.missingUnitIds)||!Array.isArray(s.evidenceIds)||!s.evidenceIds.length
      ||new Set([...s.coveredUnitIds,...s.missingUnitIds]).size!==s.expectedUnits
      ||s.coveredUnitIds.length+s.missingUnitIds.length!==s.expectedUnits)fail('INVALID_SUMMARY_COVERAGE');
    if(s.evidenceIds.some(id=>!result.evidence.some(e=>e.evidenceId===id)))fail('SUMMARY_CITATION_NOT_INCLUDED');
    if(result.status==='READY'&&(s.missingUnitIds.length||!s.text.trim()))fail('SUMMARY_INCOMPLETE');
  }else if(q.task==='DOCUMENT_SUMMARY'&&result.status==='READY')fail('SUMMARY_REPRESENTATION_REQUIRED');
  return result;
}

// Consumer-neutral HTTP description; no private database or ACG import needed.
const response=schema=>({description:'Current authorized result',content:{'application/json':{schema}}});
const documentResponse={type:'object'};
const operation=(operationId,method,body,result=documentResponse)=>({operationId,security:[{BearerAuth:[]}],...(body?{requestBody:{required:true,content:{'application/json':{schema:body}}}}:{}),responses:{'200':response(result),'401':{description:'Identity required'},'403':{description:'Current access denied'},'422':{description:'Invalid command'},'429':{description:'Budget or resource limit'},'503':{description:'Capability unavailable'}}});
const ref=name=>({$ref:'#/components/schemas/'+name});
export const httpContract=Object.freeze({openapi:'3.1.0',info:{title:'Profitia Platform Knowledge',version:CONTRACT.version},
 components:{securitySchemes:{BearerAuth:{type:'http',scheme:'bearer'}},schemas:JSON.parse(JSON.stringify(schemas.$defs).replaceAll('#/$defs/','#/components/schemas/'))},paths:{
 '/v1/imports':{post:{...operation('importDocument','POST',null),parameters:[{name:'x-pk-import',in:'header',required:true,description:'Base64url UTF-8 JSON Import metadata',schema:{type:'string',maxLength:12000}}],requestBody:{required:true,content:{'application/octet-stream':{schema:{type:'string',format:'binary'}}}},responses:{'202':response(documentResponse),'403':{description:'Import not permitted'},'422':{description:'Invalid source metadata'},'429':{description:'Budget or resource limit'}}}},
 '/v1/sources':{get:operation('listDocuments','GET',null,{type:'array',items:documentResponse})},
 '/v1/sources/{sourceId}':{parameters:[{name:'sourceId',in:'path',required:true,schema:{type:'string',format:'uuid'}},{name:'scope',in:'query',schema:{enum:['PROFITIA_SHARED','ACCOUNT_PRIVATE']}}],get:operation('getDocument','GET'),delete:operation('deleteDocument','DELETE')},
 '/v1/sources/{sourceId}/publish':{parameters:[{name:'sourceId',in:'path',required:true,schema:{type:'string',format:'uuid'}}],post:operation('publishWholeDocument','POST',{type:'object',additionalProperties:false,properties:{acknowledgePartial:{type:'boolean'},authority:{enum:['REFERENCE','HISTORICAL','BINDING_STANDARD']}}})},
 '/v1/sources/{sourceId}/withdraw':{parameters:[{name:'sourceId',in:'path',required:true,schema:{type:'string',format:'uuid'}}],post:operation('withdrawDocument','POST')},
 '/v1/sources/{sourceId}/reindex':{parameters:[{name:'sourceId',in:'path',required:true,schema:{type:'string',format:'uuid'}}],post:operation('rebuildShadowIndex','POST')},
 '/v1/source-statuses':{post:operation('pollSourceLifecycle','POST',ref('SourceStatusRequest'),{type:'object',properties:{version:{const:'0.2.0'},sources:{type:'array',items:ref('SourceStatus')}}})},
 '/v1/query':{post:operation('queryKnowledge','POST',ref('Query'),ref('Context'))},
 '/v1/capabilities':{get:operation('readCapabilities','GET')}
}});
