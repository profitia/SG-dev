/** Charges every token in the complete serialized envelope. Whole evidence
 * items are removed; quotes, tables and citation locations are never sliced. */
export function fitContext(query,evidence,{countTokens,version='0.1.0',omissions=[],continuation=null}={}){
 if(typeof countTokens!=='function'||!Number.isSafeInteger(query?.maxTokens)||query.maxTokens<1)throw TypeError('TOKENIZER_AND_BUDGET_REQUIRED');
 const result={version,requestId:query.requestId,status:'READY',evidence:[...evidence],usedTokens:0,
  tokenizerId:query.tokenizerId,targetModel:query.targetModel,omissions:[...new Set(omissions)],continuation};
 const recount=()=>{for(let i=0;i<12;i++){const n=countTokens(JSON.stringify(result));if(!Number.isSafeInteger(n)||n<0)throw TypeError('INVALID_TOKEN_COUNT');if(n===result.usedTokens)return n;result.usedTokens=n;}throw Error('TOKEN_COUNT_FIXED_POINT_REQUIRED');};
 const status=()=>{result.status=result.evidence.length?(result.omissions.length||result.evidence.some(e=>e.coverage!=='COMPLETE')?'PARTIAL':'READY'):'INSUFFICIENT_EVIDENCE';};
 status();
 while(recount()>query.maxTokens&&result.evidence.length){result.evidence.pop();if(!result.omissions.includes('BUDGET'))result.omissions.push('BUDGET');status();}
 if(recount()>query.maxTokens)throw RangeError('CONTEXT_BUDGET_TOO_SMALL');
 return result;
}

// The provider's authoritative tokenizer is asynchronous for models whose
// encoding is not published locally. Count the COMPLETE envelope, including
// metadata, rights and citation locations; never guess characters/4.
export async function fitContextAsync(query,evidence,{countTokens,version='0.1.0',omissions=[],continuation=null}={}){
 if(typeof countTokens!=='function')throw TypeError('TOKENIZER_REQUIRED');
 const items=[...evidence],missing=new Set(omissions);let prior=-1;
 for(;;){
  const value={version,requestId:query.requestId,status:items.length?(missing.size||items.some(e=>e.coverage!=='COMPLETE')?'PARTIAL':'READY'):'INSUFFICIENT_EVIDENCE',
   evidence:items,usedTokens:0,tokenizerId:query.tokenizerId,targetModel:query.targetModel,omissions:[...missing],continuation};
  for(let i=0;i<16;i++){
   const n=await countTokens(JSON.stringify(value));if(!Number.isSafeInteger(n)||n<0)throw TypeError('INVALID_TOKEN_COUNT');
   if(n===value.usedTokens){if(n<=query.maxTokens)return value;break;}
   value.usedTokens=n;
   if(i===15)throw Error('TOKEN_COUNT_NOT_STABLE');
  }
  if(!items.length)throw RangeError('CONTEXT_BUDGET_TOO_SMALL');
  // Remove batches proportionally to measured overflow, then recount. Whole
  // chunks remain literal; a large evidence item is never cut mid-citation.
  const overflow=Math.max(1,value.usedTokens-query.maxTokens),average=Math.max(1,value.usedTokens/items.length);
  items.splice(Math.max(0,items.length-Math.max(1,Math.ceil(overflow/average))));missing.add('BUDGET');
  if(prior===items.length)throw Error('CONTEXT_BUDGET_STALLED');prior=items.length;
 }
}
