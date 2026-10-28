import {FIELD_DEFINITIONS} from '@profitia/srm-adp-ui'
import type {AdpLocalEvent, AdpLocale, AdpPresentationModel} from '@profitia/srm-adp-ui'

export type LocalAdpContext = Readonly<{id: () => string; today: () => string; author: string}>

export function createLocalAdpContext(locale: AdpLocale): LocalAdpContext {
  return {id: () => `local-${crypto.randomUUID()}`, today: () => new Date().toISOString().slice(0, 10), author: locale === 'en' ? 'You' : 'Ty'}
}

export function createLocalAdpModel(organizationDisplayName: string, year = String(new Date().getFullYear())): AdpPresentationModel {
  return {
    organizationDisplayName,
    form: {
      values: Object.fromEntries(FIELD_DEFINITIONS.map(field => [field.id, ''])), roles: [], answers: {},
      declarations: [
        'Znamy Kodeks postępowania dla partnerów biznesowych (https://porr-group.com/group/einkauf) i uznajemy oraz popieramy zawarte w nim wartości i zasady.',
        'Potwierdzamy, że w naszym łańcuchu dostaw nie ma pracy dzieci i zobowiązujemy się do przestrzegania zasad UN Global Compact (https://unglobalcompact.org/what-is-gc/mission/principles) w obszarach praw człowieka, pracy, środowiska i przeciwdziałania korupcji.',
      ],
      privacyText: '(Proszę NIE wypełniać odręcznie. Szczegóły na temat przetwarzania danych można znaleźć pod adresem: https://www.porr-group.com/datenschutz)',
      archiveNote: 'Zewnętrzne i wewnętrzne podpisanie dokumentu w systemie SAP z podaniem daty wygaśnięcia (data podpisania +3 lata lub +1 rok w przypadku dostawców o znaczeniu istotnym) należy zarchiwizować. W przypadku rezygnacji z wewnętrznego podpisania archiwizacja w systemie SAP stanowi potwierdzenie wewnętrznej kontroli przeprowadzonej przez osobę odpowiedzialną za archiwizację.',
      documentMetadata: ['Dokumentacja zarządzania(Public) · FC Główny Arkusz Danych Podstawowych · GP00000', '13/03/2026 10:00:57 · FC_SP02_01_001015_GP00000_pl · Bayer Philip/Mroczkowska Magdalena · 1/1'],
    },
    owner: '', ownerOptions: ['Opiekun 1', 'Opiekun 2'],
    categoryOptions: ['Kategoria 1', 'Kategoria 2', 'Kategoria 3'], categories: [], categorySuggestions: [],
    contacts: [], locations: [], relations: [], activities: [], documents: [], projects: [], turnover: [], ratings: [],
    warning: null, warningHistory: [], plan: {year, goal: '', result: ''}, keywords: [],
  }
}

export function reduceLocalAdpModel(model: AdpPresentationModel, event: AdpLocalEvent, context: LocalAdpContext): AdpPresentationModel {
  if (event.type === 'form.change') {
    if (event.field === 'signature' || !FIELD_DEFINITIONS.some(field => field.id === event.field)) return model
    return {...model, form: {...model.form, values: {...model.form.values, [event.field]: event.value}}}
  }
  if (event.type === 'form.role') return {...model, form: {...model.form, roles: event.selected ? [...new Set([...model.form.roles, event.role])] : model.form.roles.filter(role => role !== event.role)}}
  if (event.type === 'form.answer') return ['0', '1'].includes(event.index) ? {...model, form: {...model.form, answers: {...model.form.answers, [event.index]: event.value}}} : model
  if (event.type === 'owner.select') return {...model, owner: event.owner}
  if (event.type === 'category.assign') return {...model, categories: [...new Set([...model.categories, event.value])]}
  if (event.type === 'category.remove') return {...model, categories: model.categories.filter(value => value !== event.value)}
  if (event.type === 'category.suggest') return {...model, categorySuggestions: [...model.categorySuggestions, event.value]}
  if (event.type === 'activity.complete') return {...model, activities: model.activities.map(activity => activity.id === event.id ? {...activity, done: !activity.done} : activity)}
  if (event.type === 'keyword.add') return {...model, keywords: [...model.keywords, {id: context.id(), text: event.text}]}
  if (event.type === 'keyword.edit') return {...model, keywords: model.keywords.map(keyword => keyword.id === event.id ? {...keyword, text: event.text} : keyword)}
  if (event.type === 'keyword.remove') return {...model, keywords: model.keywords.filter(keyword => keyword.id !== event.id)}
  if (!('values' in event)) return model
  const value = event.values
  if (event.type === 'contact.add') return {...model, contacts: [...model.contacts, {id: context.id(), name: value.name, role: value.role ?? '', email: value.email ?? '', phone: value.phone ?? ''}]}
  if (event.type === 'location.add') return {...model, locations: [...model.locations, {id: context.id(), name: value.name, address: value.address, scope: value.scope ?? ''}]}
  if (event.type === 'relation.add') return {...model, relations: [...model.relations, {id: context.id(), name: value.name, type: value.type, source: value.source, when: context.today()}]}
  if (event.type === 'activity.add') return {...model, activities: [{id: context.id(), type: value.type, title: value.title, when: value.when, people: value.people ?? '', body: value.body, next: value.next ?? '', due: value.due ?? '', owner: value.owner ?? '', fileName: value.fileName, done: false}, ...model.activities]}
  if (event.type === 'document.add') return {...model, documents: [...model.documents, {id: context.id(), type: value.type, name: value.name, when: value.when, note: value.body ?? '', signed: value.signed ?? ''}]}
  if (event.type === 'rating.add') {
    const score = Number(value.score)
    if (!Number.isInteger(score) || score < 1 || score > 6 || !['negotiation', 'fulfilment'].includes(value.kind)) return model
    return {...model, ratings: [{id: context.id(), kind: value.kind as 'negotiation' | 'fulfilment', score, scale: 6, direction: 'higher', comment: value.comment ?? '', project: value.project || undefined, author: context.author, when: context.today()}, ...model.ratings]}
  }
  if (event.type === 'plan.change') return {...model, plan: {...model.plan, goal: value.goal, result: value.result ?? ''}}
  if (event.type === 'warning.add') {
    const warning = {id: context.id(), body: value.body, author: context.author, when: context.today(), action: 'Dodano ostrzeżenie'}
    return {...model, warning, warningHistory: [...model.warningHistory, warning]}
  }
  if (event.type === 'warning.remove') return {...model, warning: null, warningHistory: [...model.warningHistory, {id: context.id(), body: value.body, author: context.author, when: context.today(), action: 'Zdjęto ostrzeżenie'}]}
  return model
}

export function applyScopedAdpEvent(instance: string, incomingInstance: string, model: AdpPresentationModel, event: AdpLocalEvent, context: LocalAdpContext): AdpPresentationModel {
  return incomingInstance === instance ? reduceLocalAdpModel(model, event, context) : model
}
