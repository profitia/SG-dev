/** Conversational presentation only. Identity APIs own identity, validation,
 * drafts, company source admission, memberships, invitations and entitlements.
 * No Clerk ticket, organisation grant or session is created by this module. */
export type OrganisationOnboardingStep='loading'|'nip'|'company'|'slug'|'industry'|'categories'|'team'|'summary'|'invite-choice'|'invite-emails'|'activation'|'ready'|'existing-organisation'|'unavailable'
export type CompanySelection=Readonly<{sourceRef:string;version:string}>
export type OnboardingCompany=Readonly<{entityType:'COMPANY';country:'PL';nip:string;krs:string;regon:string;legalName:string;address:string;postalCode:string}>
export type OnboardingDraft=Readonly<{version:string;answers:Readonly<Record<string,any>>}>
export type OnboardingSnapshot=Readonly<{
 draft:OnboardingDraft;avatarSex:'male'|'female'|null;salutation:string|null
 company:Readonly<{company:OnboardingCompany;selection:CompanySelection;suggestedSlug:string}>|null
 organisation:Readonly<{organisationId:string;slug:string}>|null
 categoriesRequired?:boolean;procurementVersion?:string
}>
export type OnboardingCreation=Readonly<{status:'CREATED';organisationId:string;slug:string;activation:'PENDING_PACKAGE';commandId:string}>|Readonly<{status:'INCOMPLETE_DRAFT'|'COMPANY_LOOKUP_REQUIRED'|'COMPANY_CHANGED'|'ORGANISATION_ALREADY_EXISTS'|'SLUG_UNAVAILABLE'}>
export interface OrganisationOnboardingApi {
 load():Promise<OnboardingSnapshot>
 saveDraft(input:Readonly<{expectedVersion:string;patch:Readonly<Record<string,unknown>>}>):Promise<OnboardingDraft>
 lookupCompany(input:Readonly<{nip:string;draftVersion:string}>):Promise<NonNullable<OnboardingSnapshot['company']>|Readonly<{status:'NOT_FOUND'|'UNSUPPORTED_COMPANY'|'UNAVAILABLE'}>>
 savePersonalCategories(input:Readonly<{expectedVersion:string;categories:readonly CategoryChoice[]}>):Promise<Readonly<{version:string}>>
 checkSlug(slug:string):Promise<Readonly<{available:boolean}>>
 createOrganisation(input:Readonly<{commandId:string;draftVersion:string}>):Promise<OnboardingCreation>
 sendInvitations(input:Readonly<{commandId:string;emails:readonly string[]}>):Promise<Readonly<{items:readonly Readonly<{index:number;status:string}>[]}>>
 activation():Promise<Readonly<{status:'READY';workspaceUrl:string}>|Readonly<{status:'PENDING_PACKAGE'|'UNAVAILABLE'}>>
}
export type OnboardingIssue='INVALID_NIP_LENGTH'|'INVALID_NIP'|'INVALID_ANSWER'|'COMPANY_NOT_FOUND'|'COMPANIES_ONLY'|'LOOKUP_UNAVAILABLE'|'COMPANY_CHANGED'|'SLUG_UNAVAILABLE'|'EMPTY_CATEGORIES'|'EMPTY_EMAILS'|'DRAFT_CHANGED'|'TEMPORARILY_UNAVAILABLE'
export type CategoryChoice=Readonly<{catalogueId:string}>|Readonly<{customName:string}>
const clone=<T>(v:T):T=>structuredClone(v)
function nextStep(snapshot:OnboardingSnapshot):OrganisationOnboardingStep {
 if(snapshot.organisation)return snapshot.categoriesRequired?'categories':'activation'
 const a=snapshot.draft.answers
 if(!a.nip)return 'nip'
 if(!a.companySelection)return snapshot.company?'company':'nip'
 if(snapshot.company&&(snapshot.company.selection.sourceRef!==a.companySelection.sourceRef||snapshot.company.selection.version!==a.companySelection.version))return 'company'
 if(!a.slug)return 'slug'
 if(!a.industry)return 'industry'
 if(!Array.isArray(a.categories)||a.categories.length===0)return 'categories'
 if(!a.teamRange)return 'team'
 return 'summary'
}
/** API results are read back after every persisted answer. Presentation state
 * cannot appoint an owner, join an organisation or unlock the workspace. */
export function createOrganisationOnboardingConversation(api:OrganisationOnboardingApi,newCommandId:()=>string=()=>crypto.randomUUID()){
 const state={
  step:'loading' as OrganisationOnboardingStep,busy:false,issue:null as OnboardingIssue|null,
  snapshot:null as OnboardingSnapshot|null,company:null as OnboardingSnapshot['company'],
  proposedSlug:'',invitationItems:[] as Readonly<{index:number;status:string}>[],workspaceUrl:null as string|null,
  creation:null as OnboardingCreation|null
 }
 let createCommand:{version:string;commandId:string}|null=null,inviteCommand:{key:string;commandId:string}|null=null,lastNip=''
 function adopt(snapshot:OnboardingSnapshot){
  state.snapshot=clone(snapshot);state.company=clone(snapshot.company);state.proposedSlug=snapshot.draft.answers.slug??snapshot.company?.suggestedSlug??''
  state.step=nextStep(snapshot)
 }
 async function read(){adopt(await api.load())}
 async function persist(patch:Readonly<Record<string,unknown>>){
  if(!state.snapshot)throw Error('ONBOARDING_UNAVAILABLE')
  const draft=await api.saveDraft({expectedVersion:state.snapshot.draft.version,patch:clone(patch)})
  state.snapshot={...state.snapshot,draft:clone(draft)}
 }
 async function run(work:()=>Promise<void>){
  if(state.busy)return
  state.busy=true;state.issue=null
  try{await work()}catch(error){
   if((error as {code?:string})?.code==='PROFILE_VERSION_CONFLICT'){
    try{await read();state.issue='DRAFT_CHANGED'}catch{state.step='unavailable';state.issue='TEMPORARILY_UNAVAILABLE'}
   }else {
    const code=(error as {code?:string})?.code
    state.issue=code==='INVALID_NIP'?'INVALID_NIP':code&&['INVALID_INDUSTRY','INVALID_CATEGORIES','INVALID_TEAM_RANGE','INVALID_ORGANISATION_SLUG'].includes(code)?'INVALID_ANSWER':'TEMPORARILY_UNAVAILABLE'
   }
  }finally{state.busy=false}
 }
 async function activate(){
  state.step='activation'
  const result=await api.activation()
  if(result.status==='READY'){state.workspaceUrl=result.workspaceUrl;state.step='ready'}
  else if(result.status==='UNAVAILABLE')state.issue='TEMPORARILY_UNAVAILABLE'
 }
 return {state,
  async load(){await run(async()=>{await read();if(state.step==='activation')await activate()})},
  async submitNip(value:string){
   if(state.step!=='nip'||state.busy)return
   const nip=value.trim().replace(/^PL/i,'').replace(/[\s-]/g,'')
   if(!/^[0-9]{10}$/.test(nip)){state.issue='INVALID_NIP_LENGTH';return}
   await run(async()=>{
    await persist({nip});lastNip=nip
    const result=await api.lookupCompany({nip,draftVersion:state.snapshot!.draft.version})
    if('status'in result){state.issue=result.status==='NOT_FOUND'?'COMPANY_NOT_FOUND':result.status==='UNSUPPORTED_COMPANY'?'COMPANIES_ONLY':'LOOKUP_UNAVAILABLE';return}
    state.company=clone(result);state.proposedSlug=result.suggestedSlug;state.step='company'
   })
  },
  /** A data-confirmation action; no legal authority checkbox or declaration. */
  async confirmCompany(){
   if(state.step!=='company'||!state.company)return
   await run(async()=>{await persist({companySelection:state.company!.selection});state.step='slug'})
  },
  async changeNip(){if(state.busy)return;state.company=null;state.step='nip';state.issue=null;lastNip=''},
  async submitSlug(slug:string){
   if(state.step!=='slug')return
   await run(async()=>{
    const input=slug.trim().toLowerCase(),availability=await api.checkSlug(input)
    if(!availability.available){state.issue='SLUG_UNAVAILABLE';return}
    await persist({slug:input});state.proposedSlug=input;state.step='industry'
   })
  },
  async submitIndustry(industry:Readonly<{id:string;label?:string}>){
   if(state.step!=='industry')return
   await run(async()=>{await persist({industry});state.step='categories'})
  },
  async submitCategories(categories:readonly CategoryChoice[]){
   if(state.step!=='categories')return
   if(!categories.length){state.issue='EMPTY_CATEGORIES';return}
   await run(async()=>{
    if(state.snapshot?.organisation){
     if(!state.snapshot.procurementVersion)throw Error('PROCUREMENT_PROFILE_UNAVAILABLE')
     await api.savePersonalCategories({expectedVersion:state.snapshot.procurementVersion,categories:clone(categories)})
     await read();if(state.step==='activation')await activate()
    }else{await persist({categories});state.step='team'}
   })
  },
  async submitTeam(teamRange:'1-5'|'6-10'|'11+'){
   if(state.step!=='team')return
   await run(async()=>{await persist({teamRange});state.step='summary'})
  },
  async createOrganisation(){
   if(state.step!=='summary'||!state.snapshot)return
   await run(async()=>{
    const version=state.snapshot!.draft.version
    if(!createCommand||createCommand.version!==version)createCommand={version,commandId:newCommandId()}
    const result=await api.createOrganisation({commandId:createCommand.commandId,draftVersion:version});state.creation=clone(result)
    if(result.status==='CREATED'){
     state.snapshot={...state.snapshot!,organisation:{organisationId:result.organisationId,slug:result.slug}}
     state.step='invite-choice'
    }else if(result.status==='SLUG_UNAVAILABLE'){state.step='slug';state.issue='SLUG_UNAVAILABLE'}
    else if(result.status==='ORGANISATION_ALREADY_EXISTS')state.step='existing-organisation'
    else if(result.status==='COMPANY_CHANGED'||result.status==='COMPANY_LOOKUP_REQUIRED'){
     state.issue=result.status==='COMPANY_CHANGED'?'COMPANY_CHANGED':'LOOKUP_UNAVAILABLE'
     const nip=state.snapshot!.draft.answers.nip??lastNip
     const refreshed=await api.lookupCompany({nip,draftVersion:version})
     if(!('status'in refreshed)){state.company=clone(refreshed);state.step='company'}else state.step='nip'
    }else{await read();state.issue='DRAFT_CHANGED'}
   })
  },
  async chooseInvitations(invite:boolean){
   if(state.step!=='invite-choice')return
   if(invite){state.step='invite-emails';state.issue=null}else await run(activate)
  },
  async sendInvitations(emails:readonly string[]){
   if(state.step!=='invite-emails')return
   const candidates=emails.map(x=>x.trim()).filter(Boolean)
   if(!candidates.length){state.issue='EMPTY_EMAILS';return}
   await run(async()=>{
    const key=JSON.stringify(candidates)
    if(!inviteCommand||inviteCommand.key!==key)inviteCommand={key,commandId:newCommandId()}
    const result=await api.sendInvitations({commandId:inviteCommand.commandId,emails:candidates})
    state.invitationItems=clone([...result.items])
   })
  },
  async finishInvitations(){if(state.step==='invite-emails')await run(activate)},
  async checkActivation(){if(state.step==='activation')await run(activate)}
 }
}
