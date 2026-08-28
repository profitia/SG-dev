import { NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sg-runtime',
    environment: serverEnv.APP_ENV,
    timestamp: new Date().toISOString(),
  })
}
