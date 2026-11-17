import {createHash} from 'node:crypto';

export const CHUNKING_VERSION='pk-unicode-spans-v1';
const hash=value=>createHash('sha256').update(value).digest('hex');
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);

/** Offsets are Unicode code points in the normalized document, not bytes or
 * UTF-16 indexes. Storage retains disjoint chunk text once; ordered chunks
 * reconstruct the source exactly, including whitespace and a terminal tail. */
export function chunkDocument(input,{countTokens,maxTokens=768,maxUnitsPerChunk=25}={}){
 if(typeof countTokens!=='function'||!Number.isSafeInteger(maxTokens)||maxTokens<8||maxTokens>4096
   ||!Number.isSafeInteger(maxUnitsPerChunk)||maxUnitsPerChunk<1||maxUnitsPerChunk>100
   ||!Array.isArray(input)||!input.length||input.length>10000)throw TypeError('INVALID_CHUNK_INPUT');
 const ids=new Set(),units=[],pieces=[];let cursor=0;
 for(const unit of input){
  if(!plain(unit)||typeof unit.id!=='string'||!unit.id||ids.has(unit.id)||typeof unit.text!=='string'
    ||!['PAGE','SLIDE','PARAGRAPH','TABLE','CHART'].includes(unit.kind)
    ||!Number.isSafeInteger(unit.ordinal)||unit.ordinal<1
    ||!['COMPLETE','PARTIAL','FAILED','EXCLUDED'].includes(unit.status))throw TypeError('INVALID_SOURCE_UNIT');
  ids.add(unit.id);
  // CRLF/CR conversion is explicit. No trim, Unicode replacement, lost spaces
  // or punctuation-dependent removal is permitted.
  const text=unit.text.replace(/\r\n?/g,'\n'),length=Array.from(text).length;
  units.push({id:unit.id,kind:unit.kind,ordinal:unit.ordinal,status:unit.status,start:cursor,end:cursor+length,
    ...(unit.reason?{reason:unit.reason}:{}),...(unit.derivedLocation?{derivedLocation:true}:{})});
  pieces.push(text);cursor+=length;
  if(units.length<input.length){pieces.push('\n\n');cursor+=2;}
 }
 const text=pieces.join(''),points=Array.from(text),chunks=[];
 if(points.length>2000000)throw RangeError('EXTRACTED_TEXT_LIMIT');
 const tokens=(start,end)=>{const n=countTokens(points.slice(start,end).join(''));if(!Number.isSafeInteger(n)||n<0)throw TypeError('INVALID_TOKEN_COUNT');return n;};
 for(let start=0;start<points.length;){
  let low=start+1,high=Math.min(points.length,start+16384),end=start;
  const intersecting=units.filter(u=>u.end>start&&u.start<high);
  if(intersecting.length>maxUnitsPerChunk)high=Math.min(high,intersecting[maxUnitsPerChunk].start);
  while(low<=high){const middle=Math.floor((low+high)/2);if(tokens(start,middle)<=maxTokens){end=middle;low=middle+1;}else high=middle-1;}
  if(end===start)throw RangeError('TOKEN_BUDGET_CANNOT_FIT_SOURCE');
  if(end<points.length){
   const floor=start+Math.floor((end-start)*0.7);
   for(let i=end;i>floor;i--){if(/[\n.!?。！？]/u.test(points[i-1])&&tokens(start,i)<=maxTokens){end=i;break;}}
  }
  const content=points.slice(start,end).join('');
  const locations=units.filter(u=>u.end>start&&u.start<end).map(u=>({unitId:u.id,kind:u.kind,ordinal:u.ordinal,start:Math.max(start,u.start),end:Math.min(end,u.end)}));
  // Separator-only input is retained in storage but never made into evidence.
  chunks.push({id:'chunk-'+chunks.length,start,end,text:content,tokenCount:tokens(start,end),sha256:hash(content),locations});
  start=end;
 }
 if(chunks.map(c=>c.text).join('')!==text||chunks.some((c,i)=>c.start!==(i?chunks[i-1].end:0)))throw Error('SOURCE_COVERAGE_LOSS');
 return {version:CHUNKING_VERSION,offsetUnit:'UNICODE_CODE_POINT',normalization:'CRLF_AND_CR_TO_LF; TWO_LF_BETWEEN_SOURCE_UNITS',
  sourceDigest:hash(text),characterCount:points.length,units,chunks,
  coverage:{expectedUnits:units.length,accountedUnits:units.length,completeUnits:units.filter(u=>u.status==='COMPLETE').length,
   failedUnitIds:units.filter(u=>u.status!=='COMPLETE').map(u=>u.id),extractedCharacters:points.length,chunkedCharacters:chunks.reduce((n,c)=>n+c.end-c.start,0)}};
}

export function reconstructSource(chunks,expectedDigest){
 const ordered=[...chunks].sort((a,b)=>a.start-b.start);let offset=0;
 for(const c of ordered){if(c.start!==offset||Array.from(c.text).length!==c.end-c.start||c.sha256!==hash(c.text))throw Error('SOURCE_RECONSTRUCTION_FAILED');offset=c.end;}
 const text=ordered.map(c=>c.text).join('');if(hash(text)!==expectedDigest)throw Error('SOURCE_RECONSTRUCTION_FAILED');return text;
}
