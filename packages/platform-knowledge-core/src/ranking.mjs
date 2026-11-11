/** Reciprocal rank fusion keeps unlike vector and text scores incomparable.
 * Input lists MUST already have the identical current access/rights scope. */
export function fuseCandidates({semantic=[],lexical=[],exact=[]},{limit=40}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>200)throw TypeError('INVALID_RETRIEVAL_LIMIT');
 const found=new Map();
 for(const [list,weight] of [[semantic,1],[lexical,2],[exact,4]]){
  const seen=new Set();
  for(const [rank,item] of list.entries()){
   if(!item||typeof item.id!=='string'||seen.has(item.id))continue;seen.add(item.id);
   const current=found.get(item.id)??{...item,score:0,paths:[]};
   current.score+=weight/(60+rank+1);current.paths.push(weight===4?'EXACT':weight===2?'TEXT':'SEMANTIC');found.set(item.id,current);
  }
 }
 return [...found.values()].sort((a,b)=>b.score-a.score||(b.authorityRank??0)-(a.authorityRank??0)||a.id.localeCompare(b.id)).slice(0,limit);
}

export function queryIdentifiers(text){
 if(typeof text!=='string'||text.length>64000)throw TypeError('INVALID_QUERY_TEXT');
 return [...new Set([...(text.match(/\b\d{8}-\d\b/g)??[]),...(text.match(/\b(?:ISO|EN|IEC|DIN|PN)(?:[\s/-]+(?:ISO|EN|IEC))?[\s-]+\d+(?::\d{2,4})?/gi)??[])].map(s=>s.normalize('NFKC').toUpperCase().replace(/\s+/g,' ')))];
}
