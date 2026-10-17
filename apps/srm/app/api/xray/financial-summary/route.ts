import { createRuntimeSharedFinancialHandler } from '../../../../src/server/shared-financial-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const GET = createRuntimeSharedFinancialHandler()
