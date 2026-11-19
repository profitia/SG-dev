// Earlier published reports separate every pipe-table row with a blank line.
// Adapt only that layout for the existing reader; the stored artifact is unchanged.
export function normalizeLegacyReportTables(text:string):string{
 const lines=text.split('\n'),remove=new Set<number>()
 const blank=(i:number)=>i<lines.length&&lines[i].trim()===''
 const next=(i:number)=>{while(blank(i))i++;return i}
 const cells=(i:number)=>{
  if(i>=lines.length||!/^\s*\|.*\|\s*$/.test(lines[i]))return null
  const value=lines[i].trim().slice(1,-1).split('|').map(cell=>cell.trim())
  return value.length>=2?value:null
 }
 const separator=(i:number,width:number)=>{const value=cells(i);return value!==null&&value.length===width&&value.every(cell=>/^:?-{3,}:?$/.test(cell))}
 let fence:{character:string;length:number}|null=null
 for(let i=0;i<lines.length;i++){
  const marker=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i])
  if(fence){if(marker&&marker[1][0]===fence.character&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;continue}
  if(marker){fence={character:marker[1][0],length:marker[1].length};continue}
  if(i>0&&!blank(i-1))continue
  const header=cells(i);if(!header)continue
  const divider=next(i+1);if(!separator(divider,header.length))continue
  let last=divider,row=next(divider+1),hasBody=false
  while(row<lines.length){
   const value=cells(row)
   if(value?.length!==header.length||separator(row,header.length)||separator(next(row+1),header.length))break
   if(!hasBody){for(let j=i+1;j<divider;j++)remove.add(j);hasBody=true}
   for(let j=last+1;j<row;j++)remove.add(j)
   last=row;row=next(row+1)
  }
  if(hasBody)i=last
 }
 return remove.size?lines.filter((_,i)=>!remove.has(i)).join('\n'):text
}
