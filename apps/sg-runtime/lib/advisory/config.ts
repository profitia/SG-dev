import type {
  AdvisoryWidgetAdvisor,
  AdvisoryWidgetCopy,
  AdvisoryWidgetRecommendation,
} from '@profitia/advisory-widget'
import type { Locale } from '@/i18n/routing'

export type SpendGuruDestinationId = 'benchmark-finder' | 'category-builder' | 'cost-scan' | 'contact'

export const SPENDGURU_ADVISORS: readonly AdvisoryWidgetAdvisor[] = [
  {
    id: 'adam',
    name: 'Adam',
    image: {
      src: '/advisory/adam-128.webp',
      srcSet: '/advisory/adam-128.webp 1x, /advisory/adam-256.webp 2x',
    },
  },
  {
    id: 'anna',
    name: 'Anna',
    image: {
      src: '/advisory/anna-128.webp',
      srcSet: '/advisory/anna-128.webp 1x, /advisory/anna-256.webp 2x',
    },
  },
]

export const SPENDGURU_WIDGET_COPY: Record<Locale, AdvisoryWidgetCopy> = {
  pl: {
    title: 'SpendGuru Advisory',
    status: 'Gotowy do rozmowy',
    moreOptions: 'Więcej opcji',
    changeAdvisor: 'Zmień doradcę',
    changeTo: (name) => `Zmień na ${name === 'Anna' ? 'Annę' : 'Adama'}`,
    firstContact: 'Cześć! Jestem Twoim doradcą SpendGuru. Pomogę Ci znaleźć właściwe dane i narzędzie dla Twojego wyzwania zakupowego.',
    dismissInvitation: 'Zamknij powitanie',
    intro: 'Poniżej znajdziesz częste zadania zakupowe. Czy któreś z nich pasuje do Twojej sytuacji?',
    promptsLabel: 'Typowe sytuacje',
    prompts: [
      'Potrzebuję benchmarku cenowego',
      'Chcę przeanalizować strukturę wydatków',
      'Muszę uporządkować kategorię zakupową',
      'Przygotowuję się do negocjacji z dostawcą',
    ],
    customMessageHint: 'Inny temat? Opisz go własnymi słowami.',
    placeholder: 'Napisz wiadomość…',
    messageAriaLabel: 'Twoja wiadomość',
    sendAriaLabel: 'Wyślij wiadomość',
    closeAriaLabel: 'Zamknij asystenta',
    triggerAriaLabel: 'Otwórz doradcę SpendGuru',
    typingAriaLabel: 'Asystent przygotowuje odpowiedź',
    contactLabel: 'Porozmawiaj z ekspertem',
    footerLabel: 'SpendGuru Advisory · CIC',
    errorMessage: 'Nie udało się przygotować odpowiedzi. Spróbuj ponownie.',
  },
  en: {
    title: 'SpendGuru Advisory',
    status: 'Ready to advise',
    moreOptions: 'More options',
    changeAdvisor: 'Change advisor',
    changeTo: (name) => `Switch to ${name}`,
    firstContact: 'Hi! I’m your SpendGuru advisor. I’ll help you find the right data and tool for your procurement challenge.',
    dismissInvitation: 'Dismiss greeting',
    intro: 'Below are common procurement tasks. Does one of them match your situation?',
    promptsLabel: 'Common situations',
    prompts: [
      'I need a reliable price benchmark',
      'I want to analyse our spend structure',
      'I need to organise a procurement category',
      'I am preparing for a supplier negotiation',
    ],
    customMessageHint: 'Something else? Describe it in your own words.',
    placeholder: 'Type a message…',
    messageAriaLabel: 'Your message',
    sendAriaLabel: 'Send message',
    closeAriaLabel: 'Close advisor',
    triggerAriaLabel: 'Open SpendGuru advisor',
    typingAriaLabel: 'Advisor is preparing a response',
    contactLabel: 'Talk to an expert',
    footerLabel: 'SpendGuru Advisory · CIC',
    errorMessage: 'We could not prepare a response. Please try again.',
  },
}

const DESTINATION_COPY: Record<SpendGuruDestinationId, Record<Locale, Omit<AdvisoryWidgetRecommendation, 'id' | 'href' | 'contextLabel' | 'summary' | 'lead'>>> = {
  'benchmark-finder': {
    pl: { title: 'Benchmark Finder', description: 'Znajdź wiarygodny benchmark rynkowy i cost drivere dla swojej kategorii.', actionLabel: 'Otwórz Benchmark Finder' },
    en: { title: 'Benchmark Finder', description: 'Find a reliable market benchmark and cost drivers for your category.', actionLabel: 'Open Benchmark Finder' },
  },
  'category-builder': {
    pl: { title: 'Category Builder', description: 'Zbuduj kategorię, przypisz komponenty kosztowe i właściwe benchmarki.', actionLabel: 'Otwórz Category Builder' },
    en: { title: 'Category Builder', description: 'Build a category and connect its cost components to relevant benchmarks.', actionLabel: 'Open Category Builder' },
  },
  'cost-scan': {
    pl: { title: 'Cost Scan', description: 'Przeanalizuj kosztową strukturę kategorii i zidentyfikuj źródła zmiany.', actionLabel: 'Otwórz Cost Scan' },
    en: { title: 'Cost Scan', description: 'Analyse the category cost structure and identify the sources of change.', actionLabel: 'Open Cost Scan' },
  },
  contact: {
    pl: { title: 'Rozmowa z ekspertem', description: 'Przekaż temat ekspertowi Profitia, jeśli wymaga szerszego wsparcia.', actionLabel: 'Przejdź do kontaktu' },
    en: { title: 'Expert conversation', description: 'Share the topic with a Profitia expert when broader support is needed.', actionLabel: 'Go to contact' },
  },
}

export function getSpendGuruDestination(destinationId: SpendGuruDestinationId, locale: Locale) {
  const hrefs: Record<SpendGuruDestinationId, string> = {
    'benchmark-finder': `/${locale}/benchmark-finder`,
    'category-builder': `/${locale}/category-builder`,
    'cost-scan': `/${locale}/cost-scan`,
    contact: locale === 'pl' ? 'https://profitia.pl/kontakt' : 'https://profitia.pl/en/contact',
  }
  return { id: `SG-${destinationId.toUpperCase()}`, href: hrefs[destinationId], ...DESTINATION_COPY[destinationId][locale] }
}
