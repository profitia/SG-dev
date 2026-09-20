import {
  createForecastPreparationJobsGetHandler,
  createForecastPreparationJobsPostHandler,
} from '@/lib/forecast/preparation-route-handlers'

export const dynamic = 'force-dynamic'

export const POST = createForecastPreparationJobsPostHandler()
export const GET = createForecastPreparationJobsGetHandler()
