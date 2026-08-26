/**
 * app/api/openapi/route.ts
 * GET /api/openapi
 * Returns the generated OpenAPI 3.1 schema for procurement cognition APIs.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const schema = getCognitionService().openApiSchema()
    return NextResponse.json(schema, {
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OpenAPI schema generation failed'
    return NextResponse.json(
      { error: message, code: 'OPENAPI_ERROR', timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
