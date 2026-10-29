import { z } from 'zod'
import { categoryBodySchema } from '../category/operation-contract'
import type { CciIndexedPriceResult } from './cci-indexed-price-contracts'
import type { CciNodesCalculated, CciNodesRefused } from './node-integration'

export const PCI_JOURNEY_VERSION = 'sg2.price-change-index.journey/1.0.0' as const
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value+'T00:00:00.000Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value
}, 'Valid calendar date required')
export const pciAnalysisRequest = z.object({
  contractVersion: z.literal(PCI_JOURNEY_VERSION),
  mode: z.enum(['PREPARE','ANALYSE']).optional(),
  organisationId: z.string().uuid(),
  category: categoryBodySchema,
  purchase: z.object({ amount: z.number().finite().positive(), currency: z.string().regex(/^[A-Z]{3}$/),
    unit: z.string().trim().min(1).max(64), taxBasis: z.enum(['NET','GROSS']),
    deliveryBasis: z.string().trim().min(1).max(256), purchaseDate: day,
    referenceDate: day, economicPeriodApproved: z.boolean() }).strict(),
  declarations: z.array(z.object({ componentId: z.string().min(1).max(128),
    valueKind: z.enum(['PRICE_LEVEL','PRICE_INDEX']), periodBasis: z.enum(['POINT_IN_TIME','END_OF_PERIOD','PERIOD_AVERAGE']),
    reduction: z.enum(['NATIVE_ONLY','END_OF_PERIOD','OBSERVATION_AVERAGE']) }).strict()).min(2).max(12),
}).strict()
export type PciAnalysisRequest = z.infer<typeof pciAnalysisRequest>
export type PciAnalysisResponse = { contractVersion: typeof PCI_JOURNEY_VERSION } & (
  | { status: 'CALCULATED'; core: CciNodesCalculated; indexedPrice: CciIndexedPriceResult }
  | { status: 'REFUSED'; issues: readonly { code: string; message: string }[]; core?: CciNodesRefused }
)

export type PciPreparationResponse = {contractVersion:typeof PCI_JOURNEY_VERSION;status:'PREPARED';preparation:import('@profitia/sg2-price-change-index-ui/business').PciBasePreparation}
