import type {AssistantScreenContext} from './assistant-screen-context'

/** Text supplied to the persistent skin; no conversation engine or transport. */
export type AssistantContent=Readonly<{contextLabel:string|null;welcomeLead:string;welcomeDetail:string}>
export function createAssistantContent(locale:'pl'|'en',salutation?:string|null,context?:AssistantScreenContext|null):AssistantContent {
 const en=locale==='en',greeting=(en?'Hello':'Cześć')+(salutation?`, ${salutation}`:'')+'!'
 return {
  contextLabel:context?`X-Ray · ${context.supplierName}${context.year?` · ${context.year}`:''}`:null,
  welcomeLead:greeting+' '+(en?'I am your SpendGuru advisor. Soon I will support you in your daily work, category analysis and supplier collaboration.':'Jestem Twoim doradcą SpendGuru. Wkrótce będę Cię wspierać w codziennej pracy, analizie kategorii oraz we współpracy z dostawcami.'),
  welcomeDetail:en?'Choose the application you would like to start with. Soon you will be able to talk to me.':'Tymczasem wybierz aplikację, od której chcesz zacząć, a już niedługo będzie można ze mną naprawdę porozmawiać.',
 }
}
