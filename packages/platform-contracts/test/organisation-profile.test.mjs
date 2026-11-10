import test from 'node:test'
import assert from 'node:assert/strict'
import {
 PROCUREMENT_INDUSTRIES,PROCUREMENT_TEAM_RANGES,normalizePolishNip,normalizeOrganisationSlug,suggestOrganisationSlug,
 normalizeOnboardingDraftPatch,normalizeIndustry,normalizeProcurementCategories,normalizeTeamRange,normalizeCompanyRecord,normalizeInvitationEmails,organisationCommandDigest
} from '../src/organisation-profile.mjs'
const reject=(fn,code)=>assert.throws(fn,e=>e.code===code)
test('NIP accepts one canonical country identity and rejects malformed/checksum-invalid identifiers',()=>{
 for(const value of ['1234563218','PL1234563218','pl123-456-32-18','123 456 32 18'])assert.equal(normalizePolishNip(value),'1234563218')
 for(const value of ['12345678','1234567890','0000000000','1111111111','DE1234563218','1234563218\n','1234563218;DROP TABLE x',null,1234563218])reject(()=>normalizePolishNip(value),'INVALID_NIP')
})
test('organisation address is a bounded ASCII tenant slug, with no special PORR privilege or reservation',()=>{
 assert.equal(normalizeOrganisationSlug(' PORR '),'porr')
 assert.equal(normalizeOrganisationSlug('firma-123'),'firma-123')
 for(const value of ['www','Admin','api','app','auth','development','billing','porr.spendguru.app','https://porr','a','a-','-ab','a--b','żółć','раypal','x'.repeat(49)])reject(()=>normalizeOrganisationSlug(value),'INVALID_ORGANISATION_SLUG')
 assert.equal(suggestOrganisationSlug('PORR S.A.'),'porr')
 assert.equal(suggestOrganisationSlug('Żółta Łódź Sp. z o.o.'),'zolta-lodz')
 assert.equal(suggestOrganisationSlug('WWW'),'moja-organizacja')
})
test('three sector catalogues have exactly five suggestions and an independent custom sector',()=>{
 assert.equal(PROCUREMENT_INDUSTRIES.length,4)
 assert.deepEqual(PROCUREMENT_INDUSTRIES.slice(0,3).map(i=>i.categories.length),[5,5,5])
 assert(Object.isFrozen(PROCUREMENT_INDUSTRIES[0].categories[0]))
 assert.deepEqual(normalizeIndustry({id:'construction'}),{id:'construction',label:'Budownictwo',source:'USER'})
 assert.deepEqual(normalizeIndustry({id:'other',label:'  Usługi  techniczne  '}),{id:'other',label:'Usługi techniczne',source:'USER'})
 for(const value of [{id:'construction',label:'attacker value'},{id:'unknown'},{id:'other',label:''},{id:'other',label:'a\nb'},{id:'construction',organisationId:'foreign'}])reject(()=>normalizeIndustry(value),'INVALID_INDUSTRY')
})
test('categories can cross sector suggestions; custom labels deduplicate without trusting client labels or owners',()=>{
 const categories=normalizeProcurementCategories([{customName:'  Beton i prefabrykaty  '},{catalogueId:'construction.concrete'},{catalogueId:'food.packaging'},{customName:'Energia odnawialna'},{customName:'ENERGIA ODNAWIALNA'}])
 assert.equal(categories.length,3)
 assert.equal(categories[0].catalogueId,'construction.concrete')
 assert.equal(categories[1].catalogueId,'food.packaging')
 assert.equal(categories[2].label,'Energia odnawialna')
 assert(Object.isFrozen(categories[2]))
 for(const value of [[],[{catalogueId:'foreign-category'}],[{catalogueId:'food.packaging',label:'not the official label'}],[{customName:'X',userId:'victim'}],[{customName:'abc\u202edef'}]])reject(()=>normalizeProcurementCategories(value),'INVALID_CATEGORIES')
 reject(()=>normalizeProcurementCategories(Array.from({length:21},(_,i)=>({customName:'Kategoria '+i}))),'TOO_MANY_CATEGORIES')
})
test('team ranges are disjoint, always include the respondent, and no bare number is trusted as a range',()=>{
 assert.equal(PROCUREMENT_TEAM_RANGES[0].maximum+1,PROCUREMENT_TEAM_RANGES[1].minimum)
 assert.equal(PROCUREMENT_TEAM_RANGES[1].maximum+1,PROCUREMENT_TEAM_RANGES[2].minimum)
 assert.equal(normalizeTeamRange('6-10').includesRespondent,true)
 for(const value of ['5-10','above10',5,{id:'1-5'}])reject(()=>normalizeTeamRange(value),'INVALID_TEAM_RANGE')
})
const company={entityType:'COMPANY',country:'PL',nip:'1234563218',krs:'0000123456',regon:'123456789',legalName:'Przykładowa spółka S.A.',address:'ul. Przykładowa 1, Warszawa',postalCode:'00-001'}
test('company record requires matching tax identity and explicit company classification, not merely a KRS-shaped field',()=>{
 assert.equal(normalizeCompanyRecord(company,'PL123-456-32-18').nip,'1234563218')
 for(const patch of [{entityType:'SOLE_TRADER'},{entityType:'UNKNOWN'},{country:'DE'},{organisationId:'client-supplied'}])reject(()=>normalizeCompanyRecord({...company,...patch},company.nip),'COMPANY_REQUIRED')
 reject(()=>normalizeCompanyRecord({...company,krs:'0000000000'},company.nip),'INVALID_COMPANY_IDENTIFIERS')
 reject(()=>normalizeCompanyRecord({...company,postalCode:'00001'},company.nip),'INVALID_COMPANY_ADDRESS')
 reject(()=>normalizeCompanyRecord({...company,legalName:'Bad\nname'},company.nip),'INVALID_COMPANY_NAME')
 reject(()=>normalizeCompanyRecord({...company,nip:'5261040828'},company.nip),'COMPANY_NIP_MISMATCH')
})
test('invitation collection normalises and deduplicates mail without deriving recipient names',()=>{
 assert.deepEqual(normalizeInvitationEmails([' ADA@EXAMPLE.TEST ','ada@example.test','mark@example.test'],'owner@example.test'),['ada@example.test','mark@example.test'])
 reject(()=>normalizeInvitationEmails(['OWNER@example.test'],'owner@example.test'),'CANNOT_INVITE_SELF')
 for(const email of ['a@example.test\r\nBcc:b@example.test','a..b@example.test','Ada <ada@example.test>','a@-example.test','a@exam..test','a@example.test/../x','a@localhost'])reject(()=>normalizeInvitationEmails([email],'owner@example.test'),'INVALID_INVITATION_EMAILS')
 reject(()=>normalizeInvitationEmails(Array(21).fill('a@example.test'),'owner@example.test'),'INVALID_INVITATION_EMAILS')
})
test('command digest is stable across object key order; changed values cannot reuse its fingerprint',()=>{
 assert.equal(organisationCommandDigest({b:2,a:['x']}),organisationCommandDigest({a:['x'],b:2}))
 assert.notEqual(organisationCommandDigest({a:'x'}),organisationCommandDigest({a:'y'}))
 for(const v of [{a:undefined},{a:NaN},{a:new Date()},Object.assign(Object.create({foreign:true}),{a:'x'})])reject(()=>organisationCommandDigest(v),'INVALID_COMMAND')
 let invoked=false;const value={get own(){invoked=true;return 'x'}};reject(()=>organisationCommandDigest(value),'INVALID_COMMAND');assert.equal(invoked,false)
})

test('own-account draft patch never accepts organisation authority or legal data',()=>{
 assert.equal(normalizeOnboardingDraftPatch({nip:'PL1234563218'}).nip,'1234563218')
 for(const key of ['organisationId','userId','company','memberRole','productGrant'])reject(()=>normalizeOnboardingDraftPatch({[key]:'injected'}),'INVALID_ONBOARDING_DRAFT')
 reject(()=>normalizeOnboardingDraftPatch({}),'INVALID_ONBOARDING_DRAFT')
})
