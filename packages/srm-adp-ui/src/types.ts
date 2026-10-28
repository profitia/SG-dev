export type AdpLocale = 'pl' | 'en';
export type AdpTheme = 'light' | 'dark';
export type AdpView = 'overview' | 'data' | 'cooperation' | 'activities' | 'documents' | 'ratings' | 'xray' | 'newsfeed';
export type AdpFormSection = 'company' | 'registers' | 'payments' | 'activity' | 'declarations';
export type AdpDataArea = 'adp' | 'contacts' | 'relations';
export type AdpNavigation = Readonly<{view: AdpView; section: AdpFormSection; dataArea: AdpDataArea}>;
export type AdpFieldDefinition = Readonly<{id:string;label:string;tab:AdpFormSection;group:string;note?:1|2;type?:string;multiline?:boolean;help?:string}>;
export type AdpContact = Readonly<{id:string;name:string;role:string;email:string;phone:string}>;
export type AdpLocation = Readonly<{id:string;name:string;address:string;scope:string}>;
export type AdpRelation = Readonly<{id:string;name:string;type:string;source:string;when:string}>;
export type AdpActivity = Readonly<{id:string;type:string;title:string;when:string;people:string;body:string;next:string;due:string;owner:string;done:boolean;fileName?:string}>;
export type AdpDocument = Readonly<{id:string;type:string;name:string;when:string;status?:string;signed?:string;note:string;fileName?:string}>;
export type AdpProject = Readonly<{id:string;name:string;scope:string;year:string;period:string;value:string;status:string;quantity:string;unit:string;contact:string}>;
export type AdpRating = Readonly<{id:string;kind:'negotiation'|'fulfilment';score:number;scale:4|6;comment:string;author:string;when:string;project?:string;source?:string;direction?:'higher'|'lower'}>;
export type AdpWarning = Readonly<{id:string;body:string;author:string;when:string;action:string}>;
export type AdpKeyword = Readonly<{id:string;text:string}>;
export type AdpPresentationModel = Readonly<{
  organizationDisplayName:string;
  summary?:Readonly<{adpStatus:string;adpDetails:string;agreementStatus:string;agreementDetails:string;experienceStatus:string;experienceDetails:string;recommendationStatus:string;recommendationText:string;recommendationSource?:string;recommendationDocumentId?:string;agreementDocumentId?:string}>;
  form:Readonly<{values:Readonly<Record<string,string>>;roles:readonly string[];answers:Readonly<Record<string,string>>;declarations:readonly string[];privacyText?:string}>;
  sapId?:string;
  owner:string;
  ownerOptions:readonly string[];
  categoryOptions:readonly string[];
  categories:readonly string[];
  categorySuggestions:readonly string[];
  contacts:readonly AdpContact[];
  locations:readonly AdpLocation[];
  relations:readonly AdpRelation[];
  activities:readonly AdpActivity[];
  documents:readonly AdpDocument[];
  projects:readonly AdpProject[];
  turnover:readonly Readonly<{year:string;value:string|null}>[];
  ratings:readonly AdpRating[];
  warning:AdpWarning|null;
  warningHistory:readonly AdpWarning[];
  plan:Readonly<{year:string;goal:string;result:string}>;
  keywords:readonly AdpKeyword[];
}>;
export type AdpLocalEvent =
 | {type:'form.change';field:string;value:string}
 | {type:'form.role';role:string;selected:boolean}
 | {type:'form.answer';index:string;value:string}
 | {type:'owner.select';owner:string}
 | {type:'category.assign'|'category.remove'|'category.suggest';value:string;reason?:string}
 | {type:'contact.add'|'location.add'|'relation.add'|'activity.add'|'document.add'|'rating.add'|'warning.add'|'warning.remove'|'plan.change';values:Readonly<Record<string,string>>}
 | {type:'activity.complete';id:string}
 | {type:'keyword.add'|'keyword.edit';id?:string;text:string}
 | {type:'keyword.remove';id:string};
export type AdpWorkspaceProps = Readonly<{
 contractVersion:'1.0.0';
 instanceId:string;
 locale:AdpLocale;
 theme:AdpTheme;
 model:AdpPresentationModel;
 navigation:AdpNavigation;
 onNavigate:(navigation:AdpNavigation)=>void;
 onReturn:()=>void;
 onLocalEvent:(event:AdpLocalEvent,instanceId:string)=>void;
 onDirtyChange?:(dirty:boolean)=>void;
 active?:boolean;
 state?:'ready'|'loading'|'error'|'unavailable';
 onRetry?:()=>void;
}>;
