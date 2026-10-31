import type { SavedBenchmark, BenchmarkAnalyticsSeriesResult } from '../benchmark/contracts'
import { calculateCciNodes, CciNodeValidationError } from './cci-node-calculation'
import { calculateCciIndexedPrice, CciIndexedPriceValidationError } from './cci-indexed-price'
import { PCI_SMART_VERSION, type SmartPciRequest, type SmartPciResponse, type SmartIssue } from './pci-smart-preparation-contracts'
import { prepareSmartPci } from './pci-smart-preparation'

/** Same existing Core for both modes; only strict mode may enter Indexed Price. No I/O. */
export function analyseSmartPci(input: SmartPciRequest, selected: readonly SavedBenchmark[], histories: ReadonlyMap<string, BenchmarkAnalyticsSeriesResult>, now: string): SmartPciResponse {
  const prepared = prepareSmartPci(input, selected, histories, now), preparation = prepared.preparation
  const refuse = (code: string, pl: string, en: string, detail: Partial<SmartIssue> = {}): SmartPciResponse => ({
    contractVersion: PCI_SMART_VERSION, status: 'REFUSED', preparation,
    issues: [{ code, message: input.locale === 'pl' ? pl : en, ...detail }],
  })
  if (input.mode === 'PREPARE') return { contractVersion: PCI_SMART_VERSION, status: 'PREPARED', preparation }
  if (!input.reference || input.reference.preparationId !== preparation.id) {
    return refuse('PREPARATION_CHANGED', 'Dane lub metoda zmieniły się. Sprawdź aktualną propozycję i potwierdź ją ponownie; Twoje dane zakupu pozostały zachowane.', 'The data or methodology changed. Review the current proposal and confirm it again; your purchase details remain intact.')
  }
  const context = prepared.contexts.get(input.reference.candidateId)
  if (!context) return refuse('REFERENCE_UNAVAILABLE', 'Ten okres nie jest już kwalifikowany. Wybierz aktualny, dostępny okres.', 'This period no longer qualifies. Choose a currently available period.')
  const reference = context.candidate
  if (reference.mode === 'EARLIER_MARKET_PROXY' && !input.reference.proxyMarketOnlyAccepted) {
    return refuse('PROXY_APPROVAL_REQUIRED', 'Potwierdź wcześniejsze odniesienie: wynik pokaże wyłącznie indeks rynku, bez modelowanej ceny zakupu.', 'Confirm the earlier reference: the result will show only a market index, without a modeled purchase price.')
  }
  if (reference.mode === 'STRICT_PURCHASE_REFERENCE' && reference.requiresApproval && !input.reference.strictPeriodAccepted) {
    return refuse('STRICT_PERIOD_APPROVAL_REQUIRED', 'Potwierdź znaczenie wskazanego okresu i metod dla Twojego zakupu. Data transakcji pozostanie niezmieniona.', 'Confirm the indicated period and methods for your purchase. The transaction date will stay unchanged.')
  }
  try {
    const calculation = calculateCciNodes(context.input)
    if (reference.mode === 'EARLIER_MARKET_PROXY') {
      // Structurally separate output: do not even call the monetary engine in this branch.
      const later = calculation.nodes.some(n => n.period.start > reference.period.start && n.status === 'COMPLETE')
      return { contractVersion: PCI_SMART_VERSION, status: 'PROXY_MARKET_ONLY', variant: 'EARLIER_MARKET_PROXY', preparation,
        calculation, reference, comparisonStatus: later ? 'COMPARISON_AVAILABLE' : 'NO_LATER_COMPARISON_POINT',
        purchaseContext: { ...input.purchase } }
    }
    const indexedPrice = calculateCciIndexedPrice({ calculation, basePrice: {
      amount: input.purchase.amount, currency: input.purchase.currency, unit: input.purchase.unit,
      taxBasis: input.purchase.taxBasis, deliveryBasis: { kind: 'DECLARED', description: input.purchase.deliveryBasis },
      purchaseDate: input.purchase.purchaseDate, referenceNodeStart: calculation.baseNode.start,
      modeledPriceScope: 'FULL_PURCHASE_PRICE_ALLOCATED_TO_DECLARED_COMPONENTS',
      periodMapping: reference.requiresApproval ? { kind: 'EXPLICIT_ECONOMIC_PERIOD',
        policyId: 'PCI_SMART_STRICT_PERIOD_V1', approvalRef: preparation.id,
        interpretation: 'PERIOD_REFERENCE_NOT_TRANSACTION_DATE_QUOTE' } : { kind: 'EXACT_PURCHASE_DAY' },
    } })
    return { contractVersion: PCI_SMART_VERSION, status: 'CALCULATED', variant: 'STRICT_PURCHASE_REFERENCE', preparation, calculation, indexedPrice, reference }
  } catch (error) {
    if (error instanceof CciNodeValidationError || error instanceof CciIndexedPriceValidationError) {
      const issue = error.issue
      return refuse(issue.code, 'Nie można obliczyć wyniku dla tego okresu. Sprawdź dostępność danych i wskazaną metodę.', 'The result cannot be calculated for this period. Check data availability and the indicated method.',
        { ...( 'componentId' in issue ? { componentId: issue.componentId } : {}), ...('period' in issue ? { period: issue.period } : {}) })
    }
    throw error
  }
}
