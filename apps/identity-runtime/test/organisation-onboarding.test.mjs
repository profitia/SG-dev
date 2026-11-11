import test from 'node:test'
import assert from 'node:assert/strict'
import {createOrganisationOnboardingConversation} from '../src/organisation-onboarding.ts'
const company={entityType:'COMPANY',country:'PL',nip:'1234563218',krs:'0000123456',regon:'123456789',legalName:'Fixture S.A.',address:'ul. Testowa 1',postalCode:'00-001'}
const found={company,selection:{sourceRef:'fixture-registry',version:'v1'},suggestedSlug:'fixture'}
function fixture(answers={}){
 let snapshot={draft:{version:'1',answers:structuredClone(answers)},avatarSex:'male',salutation:'Marku',company:null,organisation:null}
 const calls=[]
 const api={
  load:async()=>structuredClone(snapshot),
  saveDraft:async input=>{calls.push(['save',input]);assert.equal(input.expectedVersion,snapshot.draft.version);snapshot.draft={version:String(Number(snapshot.draft.version)+1),answers:{...snapshot.draft.answers,...input.patch}};return structuredClone(snapshot.draft)},
  lookupCompany:async input=>{calls.push(['lookup',input]);return structuredClone(found)},
  checkSlug:async slug=>{calls.push(['slug',slug]);return{available:true}},
  savePersonalCategories:async input=>{calls.push(['personalCategories',input]);snapshot.categoriesRequired=false;snapshot.procurementVersion='2';return{version:'2'}},
  createOrganisation:async input=>{calls.push(['create',input]);return{status:'CREATED',organisationId:'fixture-organisation',slug:'fixture',activation:'PENDING_PACKAGE',commandId:input.commandId}},
  sendInvitations:async input=>{calls.push(['invite',input]);return{items:input.emails.map((_,index)=>({index,status:index===0?'ALREADY_MEMBER':'QUEUED'}))}},
  activation:async()=>{calls.push(['activation']);return{status:'PENDING_PACKAGE'}}
 }
 let nonce=0
 return{api,calls,get snapshot(){return snapshot},set snapshot(value){snapshot=value},flow:()=>createOrganisationOnboardingConversation(api,()=>String(++nonce).padStart(32,'0'))}
}
const complete={nip:company.nip,companySelection:found.selection,slug:'fixture',industry:{id:'construction'},categories:[{catalogueId:'construction.asphalt'}],teamRange:{id:'6-10'}}
test('eight-digit NIP reports an actionable state without a silent request; ten digits submit once without another confirmation key',async()=>{
 const f=fixture(),flow=f.flow();await flow.load();assert.equal(flow.state.step,'nip')
 await flow.submitNip('12345678');assert.equal(flow.state.issue,'INVALID_NIP_LENGTH');assert.equal(f.calls.length,0)
 await Promise.all([flow.submitNip('1234563218'),flow.submitNip('1234563218')])
 assert.equal(f.calls.filter(x=>x[0]==='lookup').length,1);assert.equal(flow.state.step,'company')
 assert.equal(flow.state.snapshot.avatarSex,'male');assert.equal(flow.state.snapshot.salutation,'Marku')
 await flow.confirmCompany();assert.equal(flow.state.step,'slug')
 assert.deepEqual(f.snapshot.draft.answers.companySelection,found.selection)
})
test('persisted answers resume at the next unanswered question without choosing another avatar or replacing categories',async()=>{
 const f=fixture({...complete,teamRange:null}),flow=f.flow();await flow.load()
 assert.equal(flow.state.step,'team');assert.equal(flow.state.snapshot.avatarSex,'male')
 assert.deepEqual(flow.state.snapshot.draft.answers.categories,complete.categories)
 await flow.submitTeam('11+');assert.equal(flow.state.step,'summary')
})
test('a timeout retains the same completion command; a busy submit never creates a second request',async()=>{
 const f=fixture(complete),flow=f.flow();await flow.load()
 let release;const gate=new Promise(r=>{release=r});let first=true
 f.api.createOrganisation=async input=>{f.calls.push(['create',structuredClone(input)]);if(first){first=false;await gate;throw Error('network response lost')}return{status:'CREATED',organisationId:'fixture-org',slug:'fixture',activation:'PENDING_PACKAGE',commandId:input.commandId}}
 const pending=flow.createOrganisation();await flow.createOrganisation();assert.equal(f.calls.length,1)
 release();await pending;assert.equal(flow.state.step,'summary')
 await flow.createOrganisation();const commands=f.calls.filter(c=>c[0]==='create')
 assert.equal(commands.length,2);assert.deepEqual(commands[0][1],commands[1][1]);assert.equal(flow.state.step,'invite-choice')
 await flow.chooseInvitations(false);assert.equal(flow.state.step,'activation');assert.equal(flow.state.workspaceUrl,null)
})
test('same-organisation members remain visible as skipped rows while other invitations are queued',async()=>{
 const f=fixture(complete),flow=f.flow();await flow.load();await flow.createOrganisation();await flow.chooseInvitations(true)
 await flow.sendInvitations(['member@example.test','new@example.test'])
 assert.deepEqual(flow.state.invitationItems,[{index:0,status:'ALREADY_MEMBER'},{index:1,status:'QUEUED'}])
 assert.equal(flow.state.step,'invite-emails');assert.equal(flow.state.workspaceUrl,null)
 f.api.activation=async()=>({status:'READY',workspaceUrl:'https://fixture.example.test/pl/dashboard'})
 await flow.finishInvitations();assert.equal(flow.state.step,'ready');assert.equal(flow.state.workspaceUrl,'https://fixture.example.test/pl/dashboard')
})
test('a category-only invited user writes the current organisation profile, preserving the organisation and all other drafts',async()=>{
 const f=fixture(),flow=f.flow();f.snapshot={...f.snapshot,organisation:{organisationId:'existing-target',slug:'existing'},categoriesRequired:true,procurementVersion:'1'}
 await flow.load();assert.equal(flow.state.step,'categories')
 await flow.submitCategories([{customName:'My own category'}])
 assert.equal(f.calls.filter(c=>c[0]==='save').length,0);assert.equal(f.calls.filter(c=>c[0]==='create').length,0)
 assert.deepEqual(f.calls.find(c=>c[0]==='personalCategories')[1],{expectedVersion:'1',categories:[{customName:'My own category'}]})
 assert.equal(f.snapshot.organisation.organisationId,'existing-target');assert.equal(flow.state.step,'activation')
})
test('version conflict reloads current answers; a changed registry version returns to company data confirmation',async()=>{
 const f=fixture(complete),flow=f.flow();await flow.load()
 f.api.createOrganisation=async()=>({status:'COMPANY_CHANGED'})
 f.api.lookupCompany=async()=>({...found,selection:{...found.selection,version:'v2'}})
 await flow.createOrganisation();assert.equal(flow.state.step,'company');assert.equal(flow.state.issue,'COMPANY_CHANGED')
 f.api.saveDraft=async()=>{throw Object.assign(Error('conflict'),{code:'PROFILE_VERSION_CONFLICT'})}
 await flow.confirmCompany();assert.equal(flow.state.issue,'DRAFT_CHANGED');assert.equal(flow.state.step,'summary')
})
test('an existing NIP does not attach the second founder to the first organisation',async()=>{
 const f=fixture(complete),flow=f.flow();await flow.load();f.api.createOrganisation=async()=>({status:'ORGANISATION_ALREADY_EXISTS'})
 await flow.createOrganisation();assert.equal(flow.state.step,'existing-organisation');assert.equal(flow.state.snapshot.organisation,null)
 assert.equal(f.calls.filter(c=>c[0]==='activation').length,0)
})

test('formatted NIP uses one canonical lookup while preserving an existing chosen company address',async()=>{
 const f=fixture({...complete,slug:'my-chosen-address'}),flow=f.flow()
 await flow.load();await flow.changeNip();await flow.submitNip(' PL 123 456 32 18 ')
 assert.equal(flow.state.step,'company');assert.equal(flow.state.issue,null)
 assert.equal(f.calls.filter(c=>c[0]==='lookup').length,1)
 assert.equal(f.calls.find(c=>c[0]==='lookup')[1].nip,'1234563218')
 assert.equal(flow.state.proposedSlug,'my-chosen-address')
})
