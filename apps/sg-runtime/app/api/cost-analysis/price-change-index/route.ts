import {createRuntimePriceChangeIndexHandler} from '@/lib/cost-analysis/price-change-index-runtime'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const POST=createRuntimePriceChangeIndexHandler()
