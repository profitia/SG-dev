import ts from 'typescript'
import {createHash} from 'node:crypto'
import {SOURCE_PATHS} from './manifest.mjs'

const deny=code=>{throw Object.assign(Error('Repair source outside admitted subset'),{code})}
const require=(v,code='SOURCE_POLICY_REJECTED')=>{if(!v)deny(code)}
const globals=new Set(['Date','Intl','Math','Number','String','Array','Object','Boolean','JSON','RegExp','Set','Map','TypeError','Error'])
const constants=new Set(['undefined','NaN','Infinity'])
const callableGlobals=new Set(['Number','String','Boolean','TypeError','Error'])
const globalMembers={Date:new Set(['parse','UTC']),Intl:new Set(['DateTimeFormat','NumberFormat','ListFormat','PluralRules']),
 Math:new Set(['abs','ceil','floor','round','trunc','min','max','sign','pow','sqrt','PI']),
 Number:new Set(['isFinite','isInteger','isSafeInteger','isNaN','parseInt','parseFloat','MAX_SAFE_INTEGER','MIN_SAFE_INTEGER']),
 String:new Set(['fromCharCode','fromCodePoint']),Array:new Set(['isArray','from','of']),
 Object:new Set(['entries','fromEntries','keys','values','hasOwn','is']),JSON:new Set(['parse','stringify'])}
const forbiddenMembers=new Set(['constructor','prototype','__proto__','caller','callee','arguments','call','apply','bind',
 'getOwnPropertyDescriptor','getOwnPropertyDescriptors','getPrototypeOf','setPrototypeOf','defineProperty','defineProperties','create','assign','eval','random'])
const functions={C1:new Set(['calendar','calendarReference']),C2:new Set(['renderGroundedFacts']),C3:new Set(['applyQualityPolicy'])}
const hash=v=>createHash('sha256').update(v).digest('hex')

function parse(source){
 require(typeof source==='string'&&Buffer.byteLength(source)<=131072)
 const file=ts.createSourceFile('/aqc-candidate.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
 require(file.parseDiagnostics.length===0,'SOURCE_SYNTAX_INVALID');return file
}
function outsideBodies(file,allowed){
 let shape='',offset=0,found=0
 for(const node of file.statements){
  if(ts.isFunctionDeclaration(node)&&allowed.has(node.name?.text)){
   require(node.body);shape+=file.text.slice(offset,node.body.getStart(file))+'{AQC_ADMITTED_BODY:'+node.name.text+'}';offset=node.body.end;found++
  }
 }
 require(found>0,'TARGET_FUNCTION_MISSING');return shape+file.text.slice(offset)
}
function isType(n){return ts.isTypeNode(n)||ts.isInterfaceDeclaration(n)||ts.isTypeAliasDeclaration(n)}
function isName(n){
 const p=n.parent
 return ts.isPropertyAccessExpression(p)&&p.name===n
  ||(ts.isPropertyAssignment(p)||ts.isPropertySignature(p)||ts.isMethodSignature(p))&&p.name===n
  ||(ts.isVariableDeclaration(p)||ts.isParameter(p)||ts.isFunctionDeclaration(p)||ts.isFunctionExpression(p)||ts.isBindingElement(p))&&p.name===n
  ||ts.isBindingElement(p)&&p.propertyName===n
  ||ts.isImportSpecifier(p)||ts.isImportClause(p)||ts.isNamespaceImport(p)
 }
function member(n){
 if(ts.isPropertyAccessExpression(n))return n.name.text
 if(ts.isElementAccessExpression(n)){
  require(ts.isStringLiteral(n.argumentExpression)||ts.isNumericLiteral(n.argumentExpression),'DYNAMIC_MEMBER_REJECTED')
  return n.argumentExpression.text
 }
 return null
}

/** Conservative pure TypeScript subset, in addition to OS isolation and the
 * independent result oracle. No runtime evaluation or candidate imports here.
 * Only admitted function bodies may change; all other bytes stay identical. */
export function assertRepairSource({before,after,path,repairClass}){
 require(SOURCE_PATHS[repairClass]===path&&functions[repairClass],'TARGET_PATH_REJECTED')
 const previous=parse(before),file=parse(after),allowed=functions[repairClass]
 require(outsideBodies(previous,allowed)===outsideBodies(file,allowed),'OUTSIDE_FUNCTION_CHANGE')
 const options={noEmit:true,noResolve:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,strict:true}
 const host=ts.createCompilerHost(options),original=host.getSourceFile.bind(host)
 host.getSourceFile=(name,version,onError,newFile)=>name===file.fileName?file:original(name,version,onError,newFile)
 const program=ts.createProgram([file.fileName],options,host),checker=program.getTypeChecker()
 const local=symbol=>symbol?.declarations?.some(d=>d.getSourceFile()===file)
 let bodyRoot
 const writable=n=>checker.getSymbolAtLocation(n)?.declarations?.some(d=>d.getSourceFile()===file&&d.pos>=bodyRoot.pos&&d.end<=bodyRoot.end)
 const edits=[]
 function visit(n){
  if(isType(n))return
  require(!ts.isImportDeclaration(n)&&!ts.isImportEqualsDeclaration(n)&&!ts.isExportDeclaration(n)
   &&n.kind!==ts.SyntaxKind.ImportKeyword&&!ts.isMetaProperty(n)&&!ts.isAwaitExpression(n)&&!ts.isYieldExpression(n)
   &&n.kind!==ts.SyntaxKind.ThisKeyword&&n.kind!==ts.SyntaxKind.SuperKeyword
   &&!ts.isClassDeclaration(n)&&!ts.isClassExpression(n)&&!ts.isGetAccessorDeclaration(n)&&!ts.isSetAccessorDeclaration(n),'EFFECTFUL_SYNTAX_REJECTED')
  const name=member(n)
  if(name!==null){
   require(!forbiddenMembers.has(name)&&!name.startsWith('__'),'REFLECTION_REJECTED')
   if(ts.isIdentifier(n.expression)&&globals.has(n.expression.text)&&!local(checker.getSymbolAtLocation(n.expression))){
    require(globalMembers[n.expression.text]?.has(name),'GLOBAL_MEMBER_REJECTED')
   }
   if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='Date')require(name!=='now','UNTRUSTED_CLOCK_REJECTED')
   if(ts.isElementAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='Date')require(name!=='now','UNTRUSTED_CLOCK_REJECTED')
  }
  if(ts.isNewExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='Date')require((n.arguments?.length??0)>0,'UNTRUSTED_CLOCK_REJECTED')
  if(ts.isBinaryExpression(n)&&n.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&n.operatorToken.kind<=ts.SyntaxKind.LastAssignment){
   require(ts.isIdentifier(n.left)&&writable(n.left),'NONLOCAL_WRITE_REJECTED')
  }
  if((ts.isPrefixUnaryExpression(n)||ts.isPostfixUnaryExpression(n))&&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(n.operator))require(ts.isIdentifier(n.operand)&&writable(n.operand),'NONLOCAL_WRITE_REJECTED')
  require(!ts.isDeleteExpression(n),'NONLOCAL_WRITE_REJECTED')
  if(ts.isIdentifier(n)&&!isName(n)){
   const symbol=ts.isShorthandPropertyAssignment(n.parent)?checker.getShorthandAssignmentValueSymbol(n.parent):checker.getSymbolAtLocation(n)
   // Imported library implementations (including private CIC) are callable
   // bindings, never values available for reflection, serialisation or export.
   if(symbol?.declarations?.some(d=>ts.isImportSpecifier(d)||ts.isImportClause(d)||ts.isNamespaceImport(d))){
    require(ts.isCallExpression(n.parent)&&n.parent.expression===n,'IMPORTED_VALUE_ESCAPE_REJECTED')
   }
   if(!local(symbol)){
    require(constants.has(n.text)||globals.has(n.text),'FREE_IDENTIFIER_REJECTED')
    if(globals.has(n.text))require(ts.isPropertyAccessExpression(n.parent)&&n.parent.expression===n
     ||ts.isElementAccessExpression(n.parent)&&n.parent.expression===n
     ||ts.isNewExpression(n.parent)&&n.parent.expression===n
     ||ts.isCallExpression(n.parent)&&n.parent.expression===n&&callableGlobals.has(n.text),'GLOBAL_VALUE_ESCAPE_REJECTED')
   }
  }
  ts.forEachChild(n,visit)
 }
 for(const node of file.statements)if(ts.isFunctionDeclaration(node)&&allowed.has(node.name?.text)){
  bodyRoot=node.body;visit(node.body);const prior=previous.statements.find(p=>ts.isFunctionDeclaration(p)&&p.name?.text===node.name.text)
  if(prior.body.getText(previous)!==node.body.getText(file))edits.push(node.name.text)
 }
 require(edits.length>0,'NO_SOURCE_REPAIR')
 return Object.freeze({beforeSha256:hash(before),afterSha256:hash(after),functions:Object.freeze(edits)})
}
