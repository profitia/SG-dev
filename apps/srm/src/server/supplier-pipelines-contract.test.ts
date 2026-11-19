import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNip,normalizedName,parseWorkspaceCommand,parseWorkspaceRead,operationForCommand,operationForRead,requireContractVersion,SupplierPipelinesError,SUPPLIER_PIPELINES_CONTRACT} from './supplier-pipelines-contract';
import type {CommandName} from './supplier-pipelines-contract';
import {readSupplierAdpStatus} from './supplier-adp-status';
import type {AdpMetadata} from './supplier-adp-status';
import {SUPPLIER_PIPELINES_CONTRACT_ID,SUPPLIER_PIPELINES_CONTRACT_VERSION} from '../../../../packages/srm-adp-ui/src/pipelines-contract';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',d='33333333-3333-4333-8333-333333333333';
const cmd=(command:CommandName,data:Record<string,unknown>)=>({contractVersion:'1.0.0',idempotencyKey:'write_12345678',command,data});
const fails=(action:()=>unknown,code:string,field?:string)=>{
  assert.throws(action,(e:unknown)=>e instanceof SupplierPipelinesError && e.code===code && (!field||Object.hasOwn(e.fieldErrors??{},field)));
};
test('published wire identity agrees with the producer without application imports',()=>{
  assert.equal(SUPPLIER_PIPELINES_CONTRACT_ID,SUPPLIER_PIPELINES_CONTRACT.id);
  assert.equal(SUPPLIER_PIPELINES_CONTRACT_VERSION,SUPPLIER_PIPELINES_CONTRACT.version);
  requireContractVersion('1.0.0');
  for(const version of [undefined,null,'0.9.0','1.0','2.0.0'])fails(()=>requireContractVersion(version),'UNSUPPORTED_CONTRACT');
});
test('NIP normalization ignores spaces and hyphens; company-name variants have one identity key',()=>{
  for(const nip of ['526-025-02-74','5260250274',' 526 025 02 74 ','526\u00a0025\u20090274']){
    for(const displayName of ['Test sp. z o.o.',' TEST  Sp. z o.o. ','Test Spółka z ograniczoną odpowiedzialnością']){
      const parsed=parseWorkspaceCommand(cmd('SUPPLIER_CREATE',{nip,displayName}));
      assert.equal(parsed.data.nip,'5260250274');
    }
  }
});
test('NIP required, ASCII decimal and checksum including remainder ten; no registry call',()=>{
  for(const value of [undefined,null,'','  - '])fails(()=>normalizeNip(value),'NIP_REQUIRED','nip');
  for(const value of ['0000000000','5260250275','PL5260250274','５２６０２５０２７４','123','9'.repeat(100),1234567890,{},'526025027\u00004'])fails(()=>normalizeNip(value),'INVALID_NIP','nip');
  let rejectedTen=false;
  for(let n=100000000;n<100000200;n++){
    const prefix=String(n),weights=[6,5,7,2,3,4,5,6,7];
    if(weights.reduce((s,w,i)=>s+Number(prefix[i])*w,0)%11===10){
      fails(()=>normalizeNip(prefix+'0'),'INVALID_NIP');rejectedTen=true;break;
    }
  }
  assert.equal(rejectedTen,true);
});
const valid:Record<CommandName,Record<string,unknown>>={
  SUPPLIER_CREATE:{nip:'5260250274',displayName:'Firma'},
  SUPPLIER_UPDATE:{supplierId:a,expectedVersion:0,displayName:'Nowa nazwa'},
  SUPPLIER_ARCHIVE:{supplierId:a,expectedVersion:1,expectedCount:4},
  SUPPLIER_RESTORE:{supplierId:a,expectedVersion:2},
  CATEGORY_CREATE:{name:'Asfalt'},
  CATEGORY_UPDATE:{categoryId:a,expectedVersion:1,name:'Beton'},
  CATEGORY_ARCHIVE:{categoryId:a,expectedVersion:1},
  CATEGORY_RESTORE:{categoryId:a,expectedVersion:2},
  SUPPLIER_CATEGORY_ADD:{supplierId:a,categoryId:b,expectedVersion:0},
  SUPPLIER_CATEGORY_REMOVE:{supplierId:a,categoryId:b,expectedVersion:2},
  PIPELINE_CREATE:{name:'Kwalifikacja',kind:'SUPPLIER',stages:[{name:'Nowy'},{name:'Weryfikacja'}]},
  PIPELINE_UPDATE:{pipelineId:a,expectedVersion:1,name:'Nowa nazwa'},
  PIPELINE_ARCHIVE:{pipelineId:a,expectedVersion:1,expectedCount:4},
  PIPELINE_RESTORE:{pipelineId:a,expectedVersion:2},
  STAGE_ADD:{pipelineId:a,expectedVersion:1,name:'Oferta',order:1},
  STAGES_UPDATE:{pipelineId:a,expectedVersion:1,stages:[{stageId:b,name:'Drugi',order:1},{stageId:d,name:'Pierwszy',order:0}]},
  STAGE_REMOVE:{pipelineId:a,stageId:b,expectedPipelineVersion:3,expectedCount:4,targetStageId:d},
  MEMBERSHIP_ADD:{pipelineId:a,supplierId:b,stageId:d,expectedPipelineVersion:3},
  MEMBERSHIP_MOVE:{membershipId:a,stageId:b,expectedVersion:2,expectedPipelineVersion:3},
  MEMBERSHIP_END:{membershipId:a,expectedVersion:2},
  SUPPLIER_TRANSFER:{supplierId:a,sourceMembershipId:b,sourceVersion:2,targetPipelineId:d,targetStageId:b,expectedTargetVersion:3,reason:'Zmiana procesu'},
};
for(const [command,data] of Object.entries(valid)){
  test('typed command '+command+' accepts complete input and rejects user authority',()=>{
    const parsed=parseWorkspaceCommand(cmd(command as CommandName,data));assert.equal(parsed.command,command);
    assert.match(operationForCommand(parsed.command),/^supplier\.(catalog|category|pipeline|assignment)\.write$/);
    for(const key of ['organisationId','organizationId','actorAccountId','allow','role','operation','archivedAt']){
      fails(()=>parseWorkspaceCommand(cmd(command as CommandName,{...data,[key]:a})),'FIELD_INVALID');
    }
  });
}
test('mutations require an opaque replay key and reject envelope privileges/accessors/symbols',()=>{
  fails(()=>parseWorkspaceCommand({...cmd('CATEGORY_CREATE',{name:'A'}),idempotencyKey:''}),'FIELD_INVALID','idempotencyKey');
  fails(()=>parseWorkspaceCommand({...cmd('CATEGORY_CREATE',{name:'A'}),organisationId:a}),'FIELD_INVALID');
  fails(()=>parseWorkspaceCommand({...cmd('CATEGORY_CREATE',{name:'A'}),[Symbol('authority')]:true}),'FIELD_INVALID');
  const payload=cmd('CATEGORY_CREATE',{name:'A'});Object.defineProperty(payload,'data',{get(){throw Error('getter executed')},enumerable:true});
  fails(()=>parseWorkspaceCommand(payload),'FIELD_INVALID');
});
test('version/count fences must be explicit, bounded and meaningful for the selected aggregate',()=>{
  for(const value of [-1,1.5,Number.MAX_SAFE_INTEGER+1,'1',null,NaN]){
    fails(()=>parseWorkspaceCommand(cmd('SUPPLIER_UPDATE',{supplierId:a,expectedVersion:value,displayName:'A'})),'FIELD_INVALID');
  }
  fails(()=>parseWorkspaceCommand(cmd('PIPELINE_UPDATE',{pipelineId:a,expectedVersion:0,name:'A'})),'FIELD_INVALID');
  fails(()=>parseWorkspaceCommand(cmd('MEMBERSHIP_MOVE',{membershipId:a,expectedVersion:0,stageId:b,expectedPipelineVersion:1})),'FIELD_INVALID');
  fails(()=>parseWorkspaceCommand(cmd('STAGE_REMOVE',{pipelineId:a,stageId:b,expectedPipelineVersion:1,expectedCount:4})),'FIELD_INVALID','targetStageId');
  fails(()=>parseWorkspaceCommand(cmd('STAGE_REMOVE',{pipelineId:a,stageId:b,expectedPipelineVersion:1,expectedCount:4,targetStageId:b})),'FIELD_INVALID','targetStageId');
  assert.equal(parseWorkspaceCommand(cmd('STAGE_REMOVE',{pipelineId:a,stageId:b,expectedPipelineVersion:1,expectedCount:0})).data.targetStageId,undefined);
});
test('category pipelines are independent from card classification; SUPPLIER cannot select category',()=>{
  const category=parseWorkspaceCommand(cmd('PIPELINE_CREATE',{name:'Asfalt 2',kind:'CATEGORY',categoryId:a,stages:[{name:'Nowy'}]}));
  assert.equal(category.data.categoryId,a);
  fails(()=>parseWorkspaceCommand(cmd('PIPELINE_CREATE',{name:'A',kind:'CATEGORY',stages:[{name:'Nowy'}]})),'FIELD_INVALID','categoryId');
  fails(()=>parseWorkspaceCommand(cmd('PIPELINE_CREATE',{name:'A',kind:'SUPPLIER',categoryId:a,stages:[{name:'Nowy'}]})),'FIELD_INVALID','categoryId');
  assert.equal(Object.hasOwn(parseWorkspaceCommand(cmd('MEMBERSHIP_ADD',valid.MEMBERSHIP_ADD)).data,'categoryId'),false);
});
test('names, stage order, duplicate stages and payload limits are validated without changing identity',()=>{
  assert.equal(normalizedName('  ＡSFALT  \u00a0 A '),'asfalt a');
  fails(()=>parseWorkspaceCommand(cmd('CATEGORY_CREATE',{name:' '.repeat(30)})),'FIELD_INVALID');
  fails(()=>parseWorkspaceCommand(cmd('CATEGORY_CREATE',{name:'a'.repeat(201)})),'FIELD_INVALID');
  fails(()=>parseWorkspaceCommand(cmd('PIPELINE_CREATE',{name:'A',kind:'SUPPLIER',stages:[{name:'Nowy'},{name:'  NOWY '}]})),'FIELD_INVALID','stages');
  fails(()=>parseWorkspaceCommand(cmd('STAGES_UPDATE',{pipelineId:a,expectedVersion:1,stages:[{stageId:b,name:'A',order:0},{stageId:d,name:'B',order:2}]})),'FIELD_INVALID','stages');
  fails(()=>parseWorkspaceCommand(cmd('SUPPLIER_CREATE',{nip:'5260250274',displayName:'A',categoryIds:[a,a]})),'FIELD_INVALID','categoryIds');
});
test('validated nested payload is copied and frozen before asynchronous authority resolution',()=>{
  const source={nip:'5260250274',displayName:'A',contacts:[{name:'Kontakt',email:'test@example.invalid'}],categoryIds:[a]};
  const parsed=parseWorkspaceCommand(cmd('SUPPLIER_CREATE',source));source.contacts[0].name='Zmieniony';source.categoryIds.push(b);
  assert.equal((parsed.data.contacts as {name:string}[])[0].name,'Kontakt');
  assert.equal((parsed.data.categoryIds as string[]).length,1);
  assert.equal(Object.isFrozen(parsed.data.contacts),true);
  assert.equal(Object.isFrozen((parsed.data.contacts as unknown[])[0]),true);
  fails(()=>parseWorkspaceCommand(cmd('SUPPLIER_CREATE',{nip:'5260250274',displayName:'A',contacts:[{name:'A',email:'bad',role:null}]})),'FIELD_INVALID','contacts.0.email');
});
test('list pagination is stable and bounded; foreign selectors never become an authority input',()=>{
  assert.equal(parseWorkspaceRead({kind:'SUPPLIERS'}).limit,50);
  assert.equal(parseWorkspaceRead({kind:'SUPPLIERS',limit:100,cursor:a,q:'A_%'}).q,'A_%');
  fails(()=>parseWorkspaceRead({kind:'SUPPLIERS',limit:101}),'FIELD_INVALID','limit');
  fails(()=>parseWorkspaceRead({kind:'SUPPLIERS',organisationId:a}),'FIELD_INVALID');
  fails(()=>parseWorkspaceRead({kind:'CATEGORIES',supplierId:a}),'FIELD_INVALID','query');
  assert.equal(parseWorkspaceRead({kind:'SUPPLIER_BY_NIP',nip:'526-025-02-74'}).nip,'5260250274');
  for(const kind of ['SUPPLIER_CARD','HISTORY','ADP_STATUS'] as const)fails(()=>parseWorkspaceRead({kind}),'FIELD_INVALID','supplierId');
  assert.equal(operationForRead(parseWorkspaceRead({kind:'ADP_STATUS',supplierId:a})),'supplier.adp-status.read');
});
const scope={organisationId:a,supplierId:b};
const now=()=>Date.parse('2026-11-19T12:00:00Z');
const read=(value:AdpMetadata|null,instant=now)=>readSupplierAdpStatus(scope,{read:async()=>value},{now:instant});
test('ADP unknown source, unavailable source and absent evidence do not imply MISSING',async()=>{
  assert.deepEqual(await readSupplierAdpStatus(scope),{status:'UNKNOWN',projectionVersion:1});
  assert.equal((await read(null)).status,'UNKNOWN');
  assert.equal((await readSupplierAdpStatus(scope,{read:async()=>{throw Error('private payload')}})).status,'UNKNOWN');
  assert.deepEqual(await read({status:'MISSING',sourceLabel:'Potwierdzone źródło'}),{status:'MISSING',projectionVersion:1,sourceLabel:'Potwierdzone źródło'});
});
test('ADP exposes only confirmed metadata and does not invent a three-year policy',async()=>{
  const current=await read({status:'CURRENT',sourceLabel:'Metadane',signedAt:'2020-01-01T12:00:00Z',confirmedAt:'2026-11-19T10:00:00Z'});
  assert.equal(current.status,'CURRENT');assert.equal(current.validUntil,undefined);
  assert.equal((await read({status:'CURRENT',sourceLabel:'Metadane',validUntil:'2026-11-18'})).status,'OUTDATED');
  assert.equal((await read({status:'CURRENT',sourceLabel:'Metadane',confirmedAt:'2026-11-20T10:00:00Z'})).status,'UNKNOWN');
  assert.equal((await read({status:'CURRENT',sourceLabel:'https://private.example.invalid'})).status,'UNKNOWN');
  assert.equal((await read({status:'CURRENT',sourceLabel:'Metadane',signedAt:'2026-02-30T10:00:00Z'})).status,'UNKNOWN');
  assert.equal((await read({status:'MISSING',sourceLabel:'Metadane',signedAt:'2020-01-01T12:00:00Z'})).status,'UNKNOWN');
});
test('ADP calendar expiry respects Europe/Warsaw end of day including DST change',async()=>{
  const source:AdpMetadata={status:'CURRENT',sourceLabel:'Metadane',validUntil:'2026-03-29'};
  assert.equal((await read(source,()=>Date.parse('2026-03-29T21:59:59.999Z'))).status,'CURRENT');
  assert.equal((await read(source,()=>Date.parse('2026-03-29T22:00:00.000Z'))).status,'OUTDATED');
  assert.equal((await read({...source,validUntil:'2026-02-30'})).status,'UNKNOWN');
});
