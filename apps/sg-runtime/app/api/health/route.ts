import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sg-runtime',
    environment: process.env.APP_ENV ?? 'development',
    timestamp: new Date().toISOString(),
  })
}
